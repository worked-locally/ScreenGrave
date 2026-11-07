import { Hono } from 'hono'
import { db } from './db'
import { prefs } from './settings'
import { tmdbGet } from './tmdb'

// Daily notifications for new episodes and movie releases, sent to a service you choose.

export type Service = 'discord' | 'ntfy' | 'gotify' | 'telegram' | 'webhook'

export interface NotifyConfig {
  enabled: boolean
  service: Service
  hour: number // 0-23, in your time zone
  timeZone: string // e.g. "America/Phoenix", taken from your browser
  url: string // Discord webhook, ntfy/Gotify server address, or generic webhook
  topic: string // ntfy topic
  token: string // ntfy access token (optional), Gotify app token, or Telegram bot token
  chatId: string // Telegram chat id
  lastRun: string // the last day (YYYY-MM-DD, your time zone) the daily check ran
}

const DEFAULTS: NotifyConfig = {
  enabled: false,
  service: 'discord',
  hour: 9,
  timeZone: 'UTC',
  url: '',
  topic: '',
  token: '',
  chatId: '',
  lastRun: '',
}

const getRow = db.prepare('SELECT value FROM settings WHERE key = ?')
const putRow = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
)

function config(): NotifyConfig {
  const row = getRow.get('notify') as unknown as { value: string } | undefined
  if (!row) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...(JSON.parse(row.value) as Partial<NotifyConfig>) }
  } catch {
    return { ...DEFAULTS }
  }
}
const saveConfig = (c: NotifyConfig) => putRow.run('notify', JSON.stringify(c))

// ----- dates in your time zone -----

function validZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function localParts(tz: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

// ----- what's out today -----

export interface Release {
  key: string // used to avoid sending the same thing twice
  title: string
  label: string // "S2 · E4" or "Movie"
  name: string // episode name, or "In theaters" etc.
  poster: string | null
}

const libraryRows = db.prepare('SELECT key, title, list FROM library')

interface RawEp {
  air_date?: string | null
  season_number: number
  episode_number: number
  name?: string
}

function regionalRelease(
  d: { release_dates?: { results?: { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[] } },
  region: string,
) {
  const r = d.release_dates?.results?.find((x) => x.iso_3166_1 === region)
  if (!r) return null
  for (const types of [[3], [2], [4]]) {
    const hit = r.release_dates
      .filter((x) => types.includes(x.type) && x.release_date)
      .map((x) => ({ date: x.release_date.slice(0, 10), type: x.type }))
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    if (hit) return hit
  }
  return null
}

async function releasesOn(day: string): Promise<Release[]> {
  const region = prefs().region
  const rows = libraryRows.all() as unknown as { key: string; title: string; list: string }[]
  // your Watchlist, plus caught-up shows in Watched (they still get new episodes)
  const tracked = rows.filter((r) => r.list === 'watchlist' || r.key.startsWith('tv-'))
  const out: Release[] = []

  let next = 0
  async function worker() {
    while (next < tracked.length) {
      const row = tracked[next++]
      const t = JSON.parse(row.title) as { id: number; type: 'movie' | 'tv'; title: string; poster: string | null }
      try {
        if (t.type === 'tv') {
          const d = await tmdbGet(`/tv/${t.id}`)
          for (const ep of [d.last_episode_to_air, d.next_episode_to_air] as (RawEp | null)[]) {
            if (ep?.air_date !== day) continue
            const label = `S${ep.season_number} · E${ep.episode_number}`
            out.push({ key: `${row.key}:${ep.season_number}-${ep.episode_number}`, title: t.title, label, name: ep.name ?? '', poster: t.poster })
          }
        } else if (row.list === 'watchlist') {
          const d = await tmdbGet(`/movie/${t.id}?append_to_response=release_dates`)
          const hit = regionalRelease(d, region) ?? (d.release_date ? { date: d.release_date as string, type: 3 } : null)
          if (hit?.date === day) {
            const where = hit.type === 4 ? 'Out digitally' : hit.type === 2 ? 'Limited release' : 'In theaters'
            out.push({ key: `${row.key}:${day}`, title: t.title, label: 'Movie', name: where, poster: t.poster })
          }
        }
      } catch {
        // one title failing shouldn't stop the rest
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, tracked.length) }, worker))
  // the same episode can show up as both "last" and "next" on its air day
  return [...new Map(out.map((r) => [r.key, r])).values()].sort((a, b) => a.title.localeCompare(b.title))
}

// ----- sending -----

const poster = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w342${p}` : undefined)
const line = (r: Release) => `${r.title} — ${r.label}${r.name ? `: ${r.name}` : ''}`

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
}

const trimSlash = (u: string) => u.trim().replace(/\/+$/, '')

export async function send(c: NotifyConfig, heading: string, items: Release[]) {
  const text = items.length ? items.map(line).join('\n') : 'Nothing new today.'
  switch (c.service) {
    case 'discord':
      // up to 10 cards per message
      for (let i = 0; i < Math.max(items.length, 1); i += 10) {
        const chunk = items.slice(i, i + 10)
        await post(c.url, {
          username: 'ScreenGrave',
          content: i === 0 ? `**${heading}**` : undefined,
          embeds: chunk.map((r) => ({
            title: r.title,
            description: `${r.label}${r.name ? ` · ${r.name}` : ''}`,
            color: 0xff9f45,
            thumbnail: poster(r.poster) ? { url: poster(r.poster) } : undefined,
          })),
        })
      }
      return
    case 'ntfy': {
      const headers: Record<string, string> = { 'content-type': 'text/plain', Title: heading, Tags: 'clapper' }
      if (c.token) headers.Authorization = `Bearer ${c.token}`
      if (items.length === 1 && poster(items[0].poster)) headers.Attach = poster(items[0].poster)!
      await post(`${trimSlash(c.url || 'https://ntfy.sh')}/${encodeURIComponent(c.topic)}`, text, headers)
      return
    }
    case 'gotify':
      await post(`${trimSlash(c.url)}/message?token=${encodeURIComponent(c.token)}`, { title: heading, message: text, priority: 5 })
      return
    case 'telegram':
      await post(`https://api.telegram.org/bot${c.token}/sendMessage`, { chat_id: c.chatId, text: `${heading}\n\n${text}` })
      return
    case 'webhook':
      await post(c.url, {
        event: 'screengrave.releases',
        heading,
        items: items.map((r) => ({ title: r.title, label: r.label, name: r.name, poster: poster(r.poster) ?? null })),
      })
      return
  }
}

// ----- the daily check -----

const wasSent = db.prepare('SELECT 1 FROM notified WHERE key = ?')
const markSent = db.prepare('INSERT OR IGNORE INTO notified (key, sent_at) VALUES (?, ?)')
db.prepare('DELETE FROM notified WHERE sent_at < ?').run(Date.now() - 120 * 86_400_000)

let running = false

export async function runDaily(force = false): Promise<{ sent: number; skipped?: string }> {
  const c = config()
  if (!c.enabled) return { sent: 0, skipped: 'Notifications are off.' }
  if (running) return { sent: 0, skipped: 'A check is already running.' }
  const { date, hour } = localParts(c.timeZone)
  if (!force && (c.lastRun === date || hour < c.hour)) return { sent: 0 }

  running = true
  try {
    const fresh = (await releasesOn(date)).filter((r) => !wasSent.get(r.key))
    if (fresh.length) {
      const heading = fresh.length === 1 ? 'Out today on your list' : `${fresh.length} things out today on your list`
      await send(c, heading, fresh)
      for (const r of fresh) markSent.run(r.key, Date.now())
    }
    saveConfig({ ...config(), lastRun: date })
    if (fresh.length) console.log(`[screengrave] sent a notification for ${fresh.length} release(s)`)
    return { sent: fresh.length }
  } catch (e) {
    console.error('[screengrave] notification failed:', e)
    throw e
  } finally {
    running = false
  }
}

export function startScheduler() {
  // check every 10 minutes whether it's time for today's run
  const tick = () => void runDaily().catch(() => {})
  setTimeout(tick, 30_000)
  setInterval(tick, 10 * 60_000)
}

// ----- routes -----

const SERVICES = new Set<Service>(['discord', 'ntfy', 'gotify', 'telegram', 'webhook'])

function clean(input: Record<string, unknown>, prev: NotifyConfig): NotifyConfig {
  const s = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
  const next = { ...prev }
  if (typeof input.enabled === 'boolean') next.enabled = input.enabled
  if (typeof input.service === 'string' && SERVICES.has(input.service as Service)) next.service = input.service as Service
  if (typeof input.hour === 'number' && Number.isInteger(input.hour) && input.hour >= 0 && input.hour <= 23) next.hour = input.hour
  const tz = s(input.timeZone, 64)
  if (tz && validZone(tz)) next.timeZone = tz
  for (const k of ['url', 'topic', 'token', 'chatId'] as const) {
    const v = s(input[k])
    if (v !== undefined) next[k] = v
  }
  return next
}

function missing(c: NotifyConfig): string | null {
  const isUrl = (u: string) => /^https?:\/\/\S+$/i.test(u)
  switch (c.service) {
    case 'discord':
      return isUrl(c.url) ? null : 'Paste your Discord webhook URL.'
    case 'ntfy':
      return c.topic ? (c.url && !isUrl(c.url) ? 'The ntfy server address should start with https://' : null) : 'Enter an ntfy topic.'
    case 'gotify':
      return !isUrl(c.url) ? 'Enter your Gotify server address.' : c.token ? null : 'Enter your Gotify app token.'
    case 'telegram':
      return !c.token ? 'Enter your Telegram bot token.' : c.chatId ? null : 'Enter your Telegram chat ID.'
    case 'webhook':
      return isUrl(c.url) ? null : 'Enter the webhook URL.'
  }
}

export const notify = new Hono()

notify.get('/', (c) => c.json(config()))

notify.put('/', async (c) => {
  const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const next = clean(body, config())
  if (next.enabled) {
    const problem = missing(next)
    if (problem) return c.json({ error: problem }, 400)
  }
  saveConfig(next)
  return c.json(next)
})

notify.post('/test', async (c) => {
  const cfg = config()
  const problem = missing(cfg)
  if (problem) return c.json({ error: problem }, 400)
  try {
    await send(cfg, 'ScreenGrave test', [
      { key: 'test', title: 'Your notifications work', label: 'Test', name: 'New episodes and releases will look like this.', poster: null },
    ])
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: `The service said no: ${e instanceof Error ? e.message : String(e)}` }, 502)
  }
})

// run today's check right away (only sends what hasn't been sent already)
notify.post('/run', async (c) => {
  try {
    return c.json(await runDaily(true))
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 502)
  }
})
