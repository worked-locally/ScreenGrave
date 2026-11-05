import { createHash, randomBytes } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { db } from './db'
import { onPrefsChange, prefs } from './settings'
import { fetchTitle, type Title } from './tmdb'
import { VERSION } from './version'

const CLIENT_ID = process.env.TRAKT_CLIENT_ID ?? process.env.VITE_TRAKT_CLIENT_ID ?? ''
const REDIRECT_OVERRIDE = process.env.TRAKT_REDIRECT_URI?.trim() ?? ''
const AUTH_URL = process.env.TRAKT_AUTH_URL ?? 'https://auth.trakt.tv'
const API_URL = 'https://api.trakt.tv'
const UA = `ScreenGrave/${VERSION}`

if (!CLIENT_ID) console.warn('[screengrave] TRAKT_CLIENT_ID is not set, so Trakt sync is turned off.')

// ----- small key/value settings store -----

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?')
const putSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
)
const delSetting = db.prepare('DELETE FROM settings WHERE key = ?')

function readSetting<T>(key: string): T | null {
  const row = getSetting.get(key) as unknown as { value: string } | undefined
  return row ? (JSON.parse(row.value) as T) : null
}
const writeSetting = (key: string, value: unknown) => putSetting.run(key, JSON.stringify(value))

// ----- redirect address -----
// Worked out from the address you're browsing on, so the same build works on localhost,
// a LAN IP like http://192.168.1.50:8787, or https://your-domain behind a reverse proxy.
// TRAKT_REDIRECT_URI overrides it.

function redirectFor(c: Context): string {
  if (REDIRECT_OVERRIDE) return REDIRECT_OVERRIDE
  const url = new URL(c.req.url)
  const proto = (c.req.header('x-forwarded-proto') ?? url.protocol.replace(':', '')).split(',')[0].trim()
  const host = (c.req.header('x-forwarded-host') ?? c.req.header('host') ?? url.host).split(',')[0].trim()
  return `${proto}://${host}/api/trakt/callback`
}

// the address used when you connected; token refreshes must send the same one
const savedRedirect = () => readSetting<string>('trakt_redirect') ?? REDIRECT_OVERRIDE

// ----- tokens -----

interface Tokens {
  access: string
  refresh: string
  expiresAt: number
}

const OOB = 'urn:ietf:wg:oauth:2.0:oob' // "no redirect", used for device sign-in

async function tokenRequest(redirectUri: string, params: Record<string, string>): Promise<Tokens> {
  const body = new URLSearchParams({ client_id: CLIENT_ID, ...params })
  if (redirectUri) body.set('redirect_uri', redirectUri)
  const res = await fetch(`${AUTH_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
      'user-agent': UA,
    },
    body,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Trakt token request failed (${res.status}): ${text.slice(0, 300)}`)
  return parseTokens(text)
}

function parseTokens(text: string): Tokens {
  const d = JSON.parse(text) as { access_token: string; refresh_token?: string; expires_in?: number }
  return {
    access: d.access_token,
    refresh: d.refresh_token ?? '',
    expiresAt: Date.now() + (d.expires_in ?? 7 * 86400) * 1000,
  }
}

async function accessToken(): Promise<string> {
  const t = readSetting<Tokens>('trakt_tokens')
  if (!t) throw new Error('Trakt is not connected.')
  if (t.expiresAt - 5 * 60_000 > Date.now()) return t.access

  // expired or about to: swap the refresh token for a new pair
  try {
    if (!t.refresh) throw new Error('no refresh token')
    const params = { grant_type: 'refresh_token', refresh_token: t.refresh }
    const redirect = savedRedirect()
    // device sign-in tokens may refresh with or without a redirect_uri; try both
    const fresh = await tokenRequest(redirect, params).catch((e) =>
      redirect === OOB ? tokenRequest('', params) : Promise.reject(e),
    )
    if (!fresh.refresh) fresh.refresh = t.refresh
    writeSetting('trakt_tokens', fresh)
    return fresh.access
  } catch (e) {
    console.error('[screengrave] Trakt token refresh failed:', e)
    delSetting.run('trakt_tokens')
    throw new Error('Your Trakt login expired. Connect Trakt again.')
  }
}

async function traktPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID,
      authorization: `Bearer ${await accessToken()}`,
      'user-agent': UA,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Trakt ${res.status} on POST ${path}`)
  return res.json() as Promise<T>
}

async function traktGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'content-type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID,
      authorization: `Bearer ${await accessToken()}`,
      'user-agent': UA,
    },
  })
  if (!res.ok) throw new Error(`Trakt ${res.status} on ${path}`)
  return res.json() as Promise<T>
}

// ----- import -----

interface Ids {
  trakt?: number | null
  tmdb?: number | null
}
interface WatchedShow {
  last_watched_at?: string
  show?: { ids?: Ids }
}
interface WatchedMovie {
  last_watched_at?: string
  movie?: { ids?: Ids }
}
interface WatchItem {
  listed_at?: string
  show?: { ids?: Ids }
  movie?: { ids?: Ids }
}
interface Progress {
  seasons?: { number: number; episodes?: { number: number; completed?: boolean }[] }[]
}

const hasKey = db.prepare('SELECT 1 FROM library WHERE key = ?')
const removedAt = db.prepare('SELECT removed_at FROM removed WHERE key = ?')
const clearRemoved = db.prepare('DELETE FROM removed WHERE key = ?')
const insertEntry = db.prepare('INSERT OR IGNORE INTO library (key, title, list, added_at) VALUES (?, ?, ?, ?)')
const addEpisode = db.prepare('INSERT OR IGNORE INTO episodes (show, ep) VALUES (?, ?)')

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

async function runSync() {
  // send your queued changes first, so what comes back from Trakt already includes them
  await flushOutbox()

  const [shows, movies, wlShows, wlMovies] = await Promise.all([
    traktGet<WatchedShow[]>('/sync/watched/shows'),
    traktGet<WatchedMovie[]>('/sync/watched/movies'),
    traktGet<WatchItem[]>('/sync/watchlist/shows'),
    traktGet<WatchItem[]>('/sync/watchlist/movies'),
  ])

  const when = (s?: string) => (s ? Date.parse(s) || Date.now() : Date.now())
  const wanted = new Map<string, { type: 'movie' | 'tv'; id: number; list: 'watchlist' | 'watched'; at: number }>()
  let skipped = 0

  const want = (type: 'movie' | 'tv', id: number | null | undefined, list: 'watchlist' | 'watched', at?: string) => {
    if (!id) {
      skipped++ // no TMDB id on Trakt, so we can't show it
      return
    }
    const key = `${type}-${id}`
    if (wanted.get(key)?.list === 'watched') return // watched wins over watchlist
    wanted.set(key, { type, id, list, at: when(at) })
  }

  for (const m of movies) want('movie', m.movie?.ids?.tmdb, 'watched', m.last_watched_at)
  for (const w of wlMovies) want('movie', w.movie?.ids?.tmdb, 'watchlist', w.listed_at)
  for (const s of shows) want('tv', s.show?.ids?.tmdb, 'watchlist', s.last_watched_at) // in progress = watchlist
  for (const w of wlShows) want('tv', w.show?.ids?.tmdb, 'watchlist', w.listed_at)

  // only look up titles you don't already have, and skip ones you removed here,
  // unless you've watched or listed them on Trakt again since then
  const missing = [...wanted.entries()].filter(([key, w]) => {
    if (hasKey.get(key)) return false
    const row = removedAt.get(key) as unknown as { removed_at: number } | undefined
    return !row || w.at > row.removed_at
  })
  const found = await pool(missing, 6, async ([key, w]) => ({
    key,
    w,
    title: (await fetchTitle(w.type, w.id).catch(() => null)) as Title | null,
  }))

  // Trakt's watched list no longer includes episodes, so ask for each show's progress.
  // Shows that haven't been watched since the last sync are skipped.
  const lastSeen = readSetting<Record<string, string>>('trakt_show_seen') ?? {}
  const toCheck = shows.filter((s) => {
    const ids = s.show?.ids
    return ids?.trakt && ids.tmdb && lastSeen[String(ids.trakt)] !== s.last_watched_at
  })
  const progress = await pool(toCheck, 4, async (s) => {
    try {
      return { s, p: await traktGet<Progress>(`/shows/${s.show!.ids!.trakt}/progress/watched`) }
    } catch (e) {
      console.error('[screengrave] Trakt progress failed:', e)
      return { s, p: null }
    }
  })

  let titles = 0
  let episodes = 0
  db.exec('BEGIN')
  try {
    for (const f of found) {
      if (!f.title) {
        skipped++
        continue
      }
      titles += Number(insertEntry.run(f.key, JSON.stringify(f.title), f.w.list, f.w.at).changes)
      clearRemoved.run(f.key)
    }
    for (const { s, p } of progress) {
      if (!p) continue
      const showKey = `tv-${s.show!.ids!.tmdb}`
      for (const season of p.seasons ?? []) {
        if (season.number <= 0) continue // skip specials
        for (const e of season.episodes ?? []) {
          if (!e.completed) continue
          episodes += Number(addEpisode.run(showKey, `${season.number}-${e.number}`).changes)
        }
      }
      lastSeen[String(s.show!.ids!.trakt)] = s.last_watched_at ?? ''
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }

  writeSetting('trakt_show_seen', lastSeen)

  // two-way: on the first run, upload what Trakt is missing; then send anything queued
  let uploaded = 0
  if (prefs().twoWaySync && !readSetting<number>('trakt_backfill_done')) uploaded = await backfill(shows, movies)
  const sent = await flushOutbox()

  writeSetting('trakt_last_sync', Date.now())
  return { titles, episodes, skipped, uploaded, sent }
}

// ----- two-way sync: send your changes to Trakt -----
// Changes are queued in the outbox and sent a few seconds later in small batches.
// If Trakt can't be reached they stay queued and are retried, so nothing is lost.

export type PushAction = 'watchlist_add' | 'watchlist_remove' | 'history_add' | 'history_remove'
export interface PushItem {
  type: 'movie' | 'tv'
  id: number // TMDB id
  season?: number
  episode?: number
}

const upsertOutbox = db.prepare(
  `INSERT INTO outbox (item, action, payload, created_at) VALUES (?, ?, ?, ?)
   ON CONFLICT(item) DO UPDATE SET action = excluded.action, payload = excluded.payload, created_at = excluded.created_at`,
)
const allOutbox = db.prepare('SELECT item, action, payload FROM outbox ORDER BY created_at')
const deleteOutbox = db.prepare('DELETE FROM outbox WHERE item = ?')

const connected = () => !!CLIENT_ID && !!readSetting<Tokens>('trakt_tokens')
const pushing = () => connected() && prefs().twoWaySync

// turning two-way sync off drops anything still waiting to be sent
onPrefsChange((next, prev) => {
  if (prev.twoWaySync && !next.twoWaySync) db.exec('DELETE FROM outbox')
})

function itemKey(action: PushAction, i: PushItem) {
  const scope = action.startsWith('watchlist') ? 'wl' : 'hist'
  return i.season !== undefined ? `${scope}:${i.type}-${i.id}:${i.season}-${i.episode}` : `${scope}:${i.type}-${i.id}`
}

let flushTimer: NodeJS.Timeout | undefined

export function queuePush(action: PushAction, items: PushItem[]) {
  if (!pushing() || items.length === 0) return
  const now = Date.now()
  db.exec('BEGIN')
  try {
    for (const i of items) upsertOutbox.run(itemKey(action, i), action, JSON.stringify(i), now)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  scheduleFlush(3000)
}

function scheduleFlush(ms: number) {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flushOutbox(), ms)
}

// Trakt's body shape: movies by id, shows by id, episodes grouped as show → seasons → episodes
function buildBody(items: PushItem[]) {
  const movies: { ids: { tmdb: number } }[] = []
  const shows = new Map<number, Map<number, number[]>>()
  const wholeShows: { ids: { tmdb: number } }[] = []
  for (const i of items) {
    if (i.type === 'movie') movies.push({ ids: { tmdb: i.id } })
    else if (i.season === undefined) wholeShows.push({ ids: { tmdb: i.id } })
    else {
      const seasons = shows.get(i.id) ?? new Map<number, number[]>()
      seasons.set(i.season, [...(seasons.get(i.season) ?? []), i.episode!])
      shows.set(i.id, seasons)
    }
  }
  return {
    movies,
    shows: [
      ...wholeShows,
      ...[...shows.entries()].map(([id, seasons]) => ({
        ids: { tmdb: id },
        seasons: [...seasons.entries()].map(([number, eps]) => ({ number, episodes: eps.map((n) => ({ number: n })) })),
      })),
    ],
  }
}

const ENDPOINT: Record<PushAction, string> = {
  watchlist_add: '/sync/watchlist',
  watchlist_remove: '/sync/watchlist/remove',
  history_add: '/sync/history',
  history_remove: '/sync/history/remove',
}

let flushing = false

export async function flushOutbox(): Promise<number> {
  if (flushing || !pushing()) return 0
  flushing = true
  let sent = 0
  try {
    const rows = allOutbox.all() as unknown as { item: string; action: PushAction; payload: string }[]
    for (const action of Object.keys(ENDPOINT) as PushAction[]) {
      const batch = rows.filter((r) => r.action === action)
      // Trakt asks apps to keep requests modest, so send big uploads in chunks
      for (let i = 0; i < batch.length; i += 200) {
        const chunk = batch.slice(i, i + 200)
        await traktPost(ENDPOINT[action], buildBody(chunk.map((r) => JSON.parse(r.payload) as PushItem)))
        for (const r of chunk) deleteOutbox.run(r.item)
        sent += chunk.length
        await new Promise((r) => setTimeout(r, 1100)) // about one write per second
      }
    }
    if (sent) console.log(`[screengrave] sent ${sent} change(s) to Trakt`)
  } catch (e) {
    console.error('[screengrave] sending changes to Trakt failed, will retry:', e)
    scheduleFlush(60_000)
  } finally {
    flushing = false
  }
  return sent
}

// One-time upload of everything ScreenGrave has that Trakt doesn't, the first time two-way sync runs.
// Watched movies and episodes already on Trakt are skipped, so no duplicate plays are created.
const libraryRows = db.prepare('SELECT key, list FROM library')
const episodeRows = db.prepare('SELECT show, ep FROM episodes')

async function backfill(shows: WatchedShow[], movies: WatchedMovie[]) {
  const onTraktMovies = new Set(movies.map((m) => m.movie?.ids?.tmdb).filter(Boolean))
  const traktIdOf = new Map<number, number>()
  for (const s of shows) if (s.show?.ids?.tmdb && s.show.ids.trakt) traktIdOf.set(s.show.ids.tmdb, s.show.ids.trakt)

  const local = new Map<number, string[]>()
  for (const r of episodeRows.all() as unknown as { show: string; ep: string }[]) {
    const id = Number(r.show.slice(3))
    local.set(id, [...(local.get(id) ?? []), r.ep])
  }

  const watchlist: PushItem[] = []
  const history: PushItem[] = []
  for (const r of libraryRows.all() as unknown as { key: string; list: string }[]) {
    const [type, id] = r.key.split('-') as ['movie' | 'tv', string]
    if (r.list === 'watchlist') {
      // shows you've started already live under Trakt's progress, so don't also add them to its watchlist
      if (type === 'tv' && local.has(Number(id))) continue
      watchlist.push({ type, id: Number(id) })
    } else if (type === 'movie' && !onTraktMovies.has(Number(id))) history.push({ type, id: Number(id) })
  }
  await pool([...local.entries()], 4, async ([id, eps]) => {
    let done = new Set<string>()
    const traktId = traktIdOf.get(id)
    if (traktId) {
      const p = await traktGet<Progress>(`/shows/${traktId}/progress/watched`).catch(() => null)
      if (!p) return // can't compare right now; skip rather than risk duplicates
      done = new Set(
        (p.seasons ?? []).flatMap((s) => (s.episodes ?? []).filter((e) => e.completed).map((e) => `${s.number}-${e.number}`)),
      )
    }
    for (const ep of eps) {
      if (done.has(ep)) continue
      const [season, episode] = ep.split('-').map(Number)
      history.push({ type: 'tv', id, season, episode })
    }
  })

  queuePush('watchlist_add', watchlist)
  queuePush('history_add', history)
  writeSetting('trakt_backfill_done', Date.now())
  return watchlist.length + history.length
}

// ----- routes -----

const pending = new Map<string, { verifier: string; redirect: string; at: number }>() // sign-ins in progress
let syncing = false

export const trakt = new Hono()

trakt.get('/status', (c) =>
  c.json({
    configured: !!CLIENT_ID,
    connected: !!readSetting<Tokens>('trakt_tokens'),
    lastSync: readSetting<number>('trakt_last_sync'),
    pending: (db.prepare('SELECT COUNT(*) AS n FROM outbox').get() as unknown as { n: number }).n,
    redirectUri: redirectFor(c),
  }),
)

trakt.get('/connect', (c) => {
  if (!CLIENT_ID) return c.text('TRAKT_CLIENT_ID is not set on the server.', 500)

  const now = Date.now()
  for (const [s, p] of pending) if (now - p.at > 10 * 60_000) pending.delete(s)

  const verifier = randomBytes(32).toString('base64url')
  const state = randomBytes(16).toString('base64url')
  const redirect = redirectFor(c)
  pending.set(state, { verifier, redirect, at: now })

  const url = new URL('/oauth/authorize', AUTH_URL)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirect,
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    scope: 'public offline_access',
  }).toString()
  return c.redirect(url.toString())
})

trakt.get('/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state') ?? ''
  const p = pending.get(state)
  pending.delete(state)
  if (!code || !p) return c.redirect('/?trakt=error')

  try {
    writeSetting(
      'trakt_tokens',
      await tokenRequest(p.redirect, { grant_type: 'authorization_code', code, code_verifier: p.verifier }),
    )
    writeSetting('trakt_redirect', p.redirect)
    return c.redirect('/?trakt=connected')
  } catch (e) {
    console.error('[screengrave]', e)
    return c.redirect('/?trakt=error')
  }
})

// ----- device sign-in: show a code, the user enters it at trakt.tv, no redirect address needed -----

let device: { code: string; interval: number; expiresAt: number } | null = null

async function deviceRequest(path: string, payload: Record<string, string>) {
  return fetch(`${AUTH_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': UA },
    body: JSON.stringify(payload),
  })
}

trakt.post('/device/start', async (c) => {
  if (!CLIENT_ID) return c.json({ error: 'TRAKT_CLIENT_ID is not set on the server.' }, 500)
  const res = await deviceRequest('/oauth/device/code', { client_id: CLIENT_ID })
  const text = await res.text()
  if (!res.ok) {
    console.error(`[screengrave] Trakt device code failed (${res.status}): ${text.slice(0, 300)}`)
    return c.json({ error: `Trakt refused the request (${res.status}).` }, 502)
  }
  const d = JSON.parse(text) as {
    device_code: string
    user_code: string
    verification_url: string
    expires_in: number
    interval: number
  }
  device = { code: d.device_code, interval: d.interval || 5, expiresAt: Date.now() + d.expires_in * 1000 }
  return c.json({
    userCode: d.user_code,
    verificationUrl: d.verification_url,
    interval: device.interval,
    expiresIn: d.expires_in,
  })
})

trakt.post('/device/poll', async (c) => {
  if (!device || Date.now() > device.expiresAt) {
    device = null
    return c.json({ status: 'expired' })
  }
  const res = await deviceRequest('/oauth/device/token', { code: device.code, client_id: CLIENT_ID })
  const text = await res.text()

  if (res.ok) {
    device = null
    writeSetting('trakt_tokens', parseTokens(text))
    writeSetting('trakt_redirect', OOB)
    return c.json({ status: 'connected' })
  }
  switch (res.status) {
    case 400:
      return c.json({ status: 'pending' }) // not approved yet
    case 429:
      return c.json({ status: 'slow_down' })
    case 418:
      device = null
      return c.json({ status: 'denied' })
    case 404:
    case 409:
    case 410:
      device = null
      return c.json({ status: 'expired' })
    default:
      console.error(`[screengrave] Trakt device token failed (${res.status}): ${text.slice(0, 300)}`)
      return c.json({ status: 'error', message: `Trakt error ${res.status}` })
  }
})

trakt.post('/sync', async (c) => {
  if (syncing) return c.json({ error: 'A sync is already running.' }, 409)
  syncing = true
  try {
    return c.json(await runSync())
  } catch (e) {
    console.error('[screengrave] Trakt sync failed:', e)
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500)
  } finally {
    syncing = false
  }
})

trakt.post('/disconnect', (c) => {
  delSetting.run('trakt_tokens')
  delSetting.run('trakt_backfill_done') // reconnecting uploads anything Trakt is missing again
  db.exec('DELETE FROM outbox')
  return c.json({ ok: true })
})