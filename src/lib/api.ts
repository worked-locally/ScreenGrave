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
  putEntry: (key: string, entry: Library[string], auto = false) =>
    call(`/library/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ ...entry, auto }) }),
  deleteEntry: (key: string) => call(`/library/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  episodes: () => call<EpisodeMap>('/episodes'),
  changeEpisodes: (show: string, add: string[], remove: string[]) =>
    call('/episodes', { method: 'POST', body: JSON.stringify({ show, add, remove }) }),
  importData: (library: Library, episodes: EpisodeMap) =>
    call('/import', { method: 'POST', body: JSON.stringify({ library, episodes }) }),
}

export const reportSaveError = (e: unknown) => console.error('[screengrave] could not save to the server:', e)

// ----- first load, shared by every hook so it only runs once -----

let boot: Promise<{ library: Library; episodes: EpisodeMap }> | null = null

export function loadAll() {
  if (!boot) {
    boot = Promise.all([api.library(), api.episodes()]).then(([library, episodes]) => ({ library, episodes }))
    boot.catch(() => {
      boot = null // allow a retry
    })
  }
  return boot
}