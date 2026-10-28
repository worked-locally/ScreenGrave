import { useCallback, useEffect, useState } from 'react'

const KEY = 'screengrave:episodes'
type Watched = Record<string, string[]> // "tv-123" -> ["1-1", "1-2"]

const k = (season: number, episode: number) => `${season}-${episode}`

function load(): Watched {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function useEpisodes() {
  const [watched, setWatched] = useState<Watched>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(watched))
  }, [watched])

  const isWatched = useCallback(
    (show: string, season: number, episode: number) => watched[show]?.includes(k(season, episode)) ?? false,
    [watched],
  )

  // number of watched episodes, ignoring specials (season 0)
  const count = useCallback(
    (show: string) => (watched[show] ?? []).filter((key) => !key.startsWith('0-')).length,
    [watched],
  )

  // number of watched episodes in one season
  const seasonCount = useCallback(
    (show: string, season: number) => (watched[show] ?? []).filter((key) => key.startsWith(`${season}-`)).length,
    [watched],
  )

  const toggle = useCallback((show: string, season: number, episode: number) => {
    setWatched((w) => {
      const cur = new Set(w[show] ?? [])
      const key = k(season, episode)
      if (cur.has(key)) cur.delete(key)
      else cur.add(key)
      return { ...w, [show]: [...cur] }
    })
  }, [])

  const markSeason = useCallback((show: string, season: number, numbers: number[], value: boolean) => {
    setWatched((w) => {
      const cur = new Set(w[show] ?? [])
      numbers.forEach((n) => (value ? cur.add(k(season, n)) : cur.delete(k(season, n))))
      return { ...w, [show]: [...cur] }
    })
  }, [])

  // merges many shows at once (used by "Watched" and the Trakt import later)
  const addBulk = useCallback((data: Record<string, string[]>) => {
    setWatched((w) => {
      const next = { ...w }
      for (const [show, keys] of Object.entries(data)) {
        next[show] = [...new Set([...(w[show] ?? []), ...keys])]
      }
      return next
    })
  }, [])

  return { isWatched, count, seasonCount, toggle, markSeason, addBulk }
}