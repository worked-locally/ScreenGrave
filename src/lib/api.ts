import type { Library } from './library'

export type EpisodeMap = Record<string, string[]>

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (res.status === 401) {
    window.location.reload() // session expired or signed out elsewhere; the login screen takes over
    throw new Error('Signed out')
  }
  if (!res.ok) throw new Error(`Server error ${res.status} on ${path}`)
  return res.json() as Promise<T>
}

export const api = {
  library: () => call<Library>('/library'),
  putEntry: (key: string, entry: Library[string]) =>
    call(`/library/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(entry) }),
  deleteEntry: (key: string) => call(`/library/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  episodes: () => call<EpisodeMap>('/episodes'),
  changeEpisodes: (show: string, add: string[], remove: string[]) =>
    call('/episodes', { method: 'POST', body: JSON.stringify({ show, add, remove }) }),
  importData: (library: Library, episodes: EpisodeMap) =>
    call('/import', { method: 'POST', body: JSON.stringify({ library, episodes }) }),
}

export const reportSaveError = (e: unknown) => console.error('[screengrave] could not save to the server:', e)

// ----- one-time upload of data saved in this browser before the server existed -----

const OLD_LIBRARY = 'screengrave:library'
const OLD_EPISODES = 'screengrave:episodes'
const MIGRATED = 'screengrave:migrated'

function readOld<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

async function migrateOnce() {
  if (localStorage.getItem(MIGRATED)) return
  const oldLibrary = readOld<Record<string, { title: Library[string]['title']; list: string; addedAt?: number }>>(OLD_LIBRARY) ?? {}
  const oldEpisodes = readOld<EpisodeMap>(OLD_EPISODES) ?? {}

  const library: Library = {}
  for (const [k, v] of Object.entries(oldLibrary)) {
    library[k] = { title: v.title, list: v.list === 'watched' ? 'watched' : 'watchlist', addedAt: v.addedAt }
  }

  if (Object.keys(library).length || Object.keys(oldEpisodes).length) {
    await api.importData(library, oldEpisodes)
  }
  // the old browser copy is kept as a backup; this flag just stops it uploading again
  localStorage.setItem(MIGRATED, '1')
}

// ----- first load, shared by every hook so it only runs once -----

let boot: Promise<{ library: Library; episodes: EpisodeMap }> | null = null

export function loadAll() {
  if (!boot) {
    boot = (async () => {
      await migrateOnce()
      const [library, episodes] = await Promise.all([api.library(), api.episodes()])
      return { library, episodes }
    })()
    boot.catch(() => {
      boot = null // allow a retry
    })
  }
  return boot
}