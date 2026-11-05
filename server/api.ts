import { Hono } from 'hono'
import { db } from './db'
import { queuePush, type PushItem } from './trakt'

const KEY = /^(tv|movie)-\d+$/
const SHOW = /^tv-\d+$/
const EP = /^\d+-\d+$/
const LISTS = new Set(['watchlist', 'watched'])

interface Entry {
  title?: unknown
  list?: string
  addedAt?: number
  auto?: boolean // moved by the smart Watchlist, not by you: never sent to Trakt
}

const findList = db.prepare('SELECT list FROM library WHERE key = ?')

function itemOf(key: string): PushItem {
  const [type, id] = key.split('-') as ['movie' | 'tv', string]
  return { type, id: Number(id) }
}
const episodeItems = (show: string, eps: string[]): PushItem[] =>
  eps.map((ep) => {
    const [season, episode] = ep.split('-').map(Number)
    return { type: 'tv', id: Number(show.slice(3)), season, episode }
  })

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
  const prev = (findList.get(key) as unknown as { list: string } | undefined)?.list
  upsertEntry.run(key, JSON.stringify(body.title), body.list!, body.addedAt ?? Date.now())
  clearRemoved.run(key) // you added it back yourself

  if (!body.auto && prev !== body.list) {
    const item = itemOf(key)
    if (body.list === 'watchlist') queuePush('watchlist_add', [item])
    else {
      queuePush('watchlist_remove', [item])
      // a movie counts as one watch; a show's watches are its episodes (sent separately)
      if (item.type === 'movie') queuePush('history_add', [item])
    }
  }
  return c.json({ ok: true })
})

api.delete('/library/:key', (c) => {
  const key = c.req.param('key')
  if (!KEY.test(key)) return c.json({ error: 'invalid key' }, 400)
  const prev = (findList.get(key) as unknown as { list: string } | undefined)?.list
  deleteEntry.run(key)
  markRemoved.run(key, Date.now())

  const item = itemOf(key)
  if (prev === 'watchlist') queuePush('watchlist_remove', [item])
  else if (prev === 'watched' && item.type === 'movie') queuePush('history_remove', [item])
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
  const add = cleanEps(body.add)
  const remove = cleanEps(body.remove)
  transaction(() => {
    for (const ep of add) addEpisode.run(show, ep)
    for (const ep of remove) removeEpisode.run(show, ep)
  })
  queuePush('history_add', episodeItems(show, add))
  queuePush('history_remove', episodeItems(show, remove))
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
  const newEps: PushItem[] = []
  transaction(() => {
    for (const [key, e] of Object.entries(body.library ?? {})) {
      if (!validEntry(key, e)) continue
      insertEntryIfMissing.run(key, JSON.stringify(e.title), e.list!, e.addedAt ?? null)
      titles++
    }
    for (const [show, list] of Object.entries(body.episodes ?? {})) {
      if (!SHOW.test(show)) continue
      for (const ep of cleanEps(list)) {
        // only episodes that weren't already checked off get sent to Trakt
        if (Number(addEpisode.run(show, ep).changes)) newEps.push(...episodeItems(show, [ep]))
        eps++
      }
    }
  })
  queuePush('history_add', newEps)
  return c.json({ ok: true, titles, episodes: eps })
})