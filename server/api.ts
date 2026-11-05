import { Hono } from 'hono'
import { db } from './db'

const KEY = /^(tv|movie)-\d+$/
const SHOW = /^tv-\d+$/
const EP = /^\d+-\d+$/
const LISTS = new Set(['watchlist', 'watched'])

interface Entry {
  title?: unknown
  list?: string
  addedAt?: number
}

interface LibraryRow {
  key: string
  title: string
  list: string
  added_at: number | null
}

interface EpisodeRow {
  show: string
  ep: string
}

const validEntry = (key: string, e: Entry | null | undefined): e is Entry =>
  KEY.test(key) && !!e && typeof e.title === 'object' && e.title !== null && LISTS.has(e.list ?? '')

const cleanEps = (list: unknown): string[] =>
  Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && EP.test(x)) : []

const upsertEntry = db.prepare(`
  INSERT INTO library (key, title, list, added_at) VALUES (?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET title = excluded.title, list = excluded.list, added_at = excluded.added_at
`)
const insertEntryIfMissing = db.prepare('INSERT OR IGNORE INTO library (key, title, list, added_at) VALUES (?, ?, ?, ?)')
const deleteEntry = db.prepare('DELETE FROM library WHERE key = ?')
const markRemoved = db.prepare(
  'INSERT INTO removed (key, removed_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET removed_at = excluded.removed_at',
)
const clearRemoved = db.prepare('DELETE FROM removed WHERE key = ?')
const addEpisode = db.prepare('INSERT OR IGNORE INTO episodes (show, ep) VALUES (?, ?)')
const removeEpisode = db.prepare('DELETE FROM episodes WHERE show = ? AND ep = ?')
const allLibrary = db.prepare('SELECT key, title, list, added_at FROM library')
const allEpisodes = db.prepare('SELECT show, ep FROM episodes')

function transaction(fn: () => void) {
  db.exec('BEGIN')
  try {
    fn()
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export const api = new Hono()

// ----- library -----

api.get('/library', (c) => {
  const out: Record<string, unknown> = {}
  for (const row of allLibrary.all() as unknown as LibraryRow[]) {
    out[row.key] = {
      title: JSON.parse(row.title),
      list: row.list,
      ...(row.added_at ? { addedAt: row.added_at } : {}),
    }
  }
  return c.json(out)
})

api.put('/library/:key', async (c) => {
  const key = c.req.param('key')
  const body = (await c.req.json().catch(() => null)) as Entry | null
  if (!validEntry(key, body)) return c.json({ error: 'invalid entry' }, 400)
  upsertEntry.run(key, JSON.stringify(body.title), body.list!, body.addedAt ?? Date.now())
  clearRemoved.run(key) // you added it back yourself
  return c.json({ ok: true })
})

api.delete('/library/:key', (c) => {
  const key = c.req.param('key')
  if (!KEY.test(key)) return c.json({ error: 'invalid key' }, 400)
  deleteEntry.run(key)
  markRemoved.run(key, Date.now())
  return c.json({ ok: true })
})

// ----- episodes -----

api.get('/episodes', (c) => {
  const out: Record<string, string[]> = {}
  for (const row of allEpisodes.all() as unknown as EpisodeRow[]) {
    ;(out[row.show] ??= []).push(row.ep)
  }
  return c.json(out)
})

api.post('/episodes', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { show?: string; add?: unknown; remove?: unknown } | null
  if (!body?.show || !SHOW.test(body.show)) return c.json({ error: 'invalid show' }, 400)
  const show = body.show
  transaction(() => {
    for (const ep of cleanEps(body.add)) addEpisode.run(show, ep)
    for (const ep of cleanEps(body.remove)) removeEpisode.run(show, ep)
  })
  return c.json({ ok: true })
})

// ----- bulk import (first-run migration, "Watched" on a whole show, Trakt later) -----
// only adds what isn't there yet; never overwrites

api.post('/import', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    library?: Record<string, Entry>
    episodes?: Record<string, unknown>
  } | null
  if (!body) return c.json({ error: 'invalid body' }, 400)

  let titles = 0
  let eps = 0
  transaction(() => {
    for (const [key, e] of Object.entries(body.library ?? {})) {
      if (!validEntry(key, e)) continue
      insertEntryIfMissing.run(key, JSON.stringify(e.title), e.list!, e.addedAt ?? null)
      titles++
    }
    for (const [show, list] of Object.entries(body.episodes ?? {})) {
      if (!SHOW.test(show)) continue
      for (const ep of cleanEps(list)) {
        addEpisode.run(show, ep)
        eps++
      }
    }
  })
  return c.json({ ok: true, titles, episodes: eps })
})