import { useCallback, useEffect, useState } from 'react'
import { api, loadAll, reportSaveError, type EpisodeMap } from './api'

const k = (season: number, episode: number) => `${season}-${episode}`

export function useEpisodes() {
  const [watched, setWatched] = useState<EpisodeMap>({}) // "tv-123" -> ["1-1", "1-2"]

  useEffect(() => {
    let cancelled = false
    loadAll()
      .then((d) => {
        if (!cancelled) setWatched(d.episodes)
      })
      .catch(() => {
        // the library hook shows the error screen
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    const key = k(season, episode)
    setWatched((w) => {
      const cur = new Set(w[show] ?? [])
      if (cur.has(key)) {
        cur.delete(key)
        api.changeEpisodes(show, [], [key]).catch(reportSaveError)
      } else {
        cur.add(key)
        api.changeEpisodes(show, [key], []).catch(reportSaveError)
      }
      return { ...w, [show]: [...cur] }
    })
  }, [])

  const markSeason = useCallback((show: string, season: number, numbers: number[], value: boolean) => {
    const keys = numbers.map((n) => k(season, n))
    api.changeEpisodes(show, value ? keys : [], value ? [] : keys).catch(reportSaveError)
    setWatched((w) => {
      const cur = new Set(w[show] ?? [])
      keys.forEach((key) => (value ? cur.add(key) : cur.delete(key)))
      return { ...w, [show]: [...cur] }
    })
  }, [])

  // merges many shows at once (used by "Watched" and the Trakt import later)
  const addBulk = useCallback((data: EpisodeMap) => {
    api.importData({}, data).catch(reportSaveError)
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