import { Hono } from 'hono'
import { db } from './db'

// Preferences you change in the app's Settings screen, stored in the database.

export interface Prefs {
  displayName: string
  region: string // two-letter country code for release dates and streaming services
  twoWaySync: boolean // send your changes to Trakt
}

const DEFAULTS: Prefs = {
  displayName: '',
  region: 'US',
  twoWaySync: true,
}

const getRow = db.prepare('SELECT value FROM settings WHERE key = ?')
const putRow = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
)

const KEY = 'prefs'

export function prefs(): Prefs {
  const row = getRow.get(KEY) as unknown as { value: string } | undefined
  if (!row) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...(JSON.parse(row.value) as Partial<Prefs>) }
  } catch {
    return { ...DEFAULTS }
  }
}

function clean(input: Partial<Record<keyof Prefs, unknown>>): Partial<Prefs> {
  const out: Partial<Prefs> = {}
  if (typeof input.displayName === 'string') out.displayName = input.displayName.trim().slice(0, 24)
  if (typeof input.region === 'string' && /^[A-Z]{2}$/.test(input.region)) out.region = input.region
  if (typeof input.twoWaySync === 'boolean') out.twoWaySync = input.twoWaySync
  return out
}

type Listener = (next: Prefs, prev: Prefs) => void
const listeners: Listener[] = []
export const onPrefsChange = (fn: Listener) => listeners.push(fn)

// used by first-run setup to save your name along with the password
export function savePrefsDirect(change: Partial<Prefs>) {
  const prev = prefs()
  const next = { ...prev, ...clean(change) }
  putRow.run(KEY, JSON.stringify(next))
  for (const fn of listeners) fn(next, prev)
}


export const settings = new Hono()

settings.get('/', (c) => c.json(prefs()))

settings.put('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<Record<keyof Prefs, unknown>> | null
  if (!body) return c.json({ error: 'invalid body' }, 400)
  const prev = prefs()
  const next = { ...prev, ...clean(body) }
  putRow.run(KEY, JSON.stringify(next))
  for (const fn of listeners) fn(next, prev)
  return c.json(next)
})
