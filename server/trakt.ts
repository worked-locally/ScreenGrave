import { createHash, randomBytes } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { db } from './db'
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
  writeSetting('trakt_last_sync', Date.now())
  return { titles, episodes, skipped }
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
  return c.json({ ok: true })
})