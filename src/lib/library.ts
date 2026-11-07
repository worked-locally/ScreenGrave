import { useCallback, useEffect, useState } from 'react'
import { api, loadAll, reportSaveError } from './api'
import type { Title } from './tmdb'

export type ListName = 'watchlist' | 'watched'
export type Entry = { title: Title; list: ListName; addedAt?: number }
export type Library = Record<string, Entry>

export const keyOf = (t: Title) => `${t.type}-${t.id}`

export function useLibrary() {
  const [library, setLibrary] = useState<Library>({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadAll()
      .then((d) => {
        if (cancelled) return
        setLibrary(d.library)
        setReady(true)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // auto = moved by the smart Watchlist rather than by you (those moves aren't sent to Trakt)
  const setList = useCallback((t: Title, list: ListName, auto = false) => {
    setLibrary((l) => {
      const prev = l[keyOf(t)]
      const entry: Entry = { title: t, list, addedAt: prev && prev.list === list ? prev.addedAt : Date.now() }
      api.putEntry(keyOf(t), entry, auto).catch(reportSaveError)
      return { ...l, [keyOf(t)]: entry }
    })
  }, [])

  const remove = useCallback((t: Title) => {
    api.deleteEntry(keyOf(t)).catch(reportSaveError)
    setLibrary((l) => {
      const next = { ...l }
      delete next[keyOf(t)]
      return next
    })
  }, [])

  return { library, ready, error, setList, remove }
}