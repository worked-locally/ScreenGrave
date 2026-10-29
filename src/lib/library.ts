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

  const setList = useCallback((t: Title, list: ListName) => {
    setLibrary((l) => {
      const prev = l[keyOf(t)]
      const entry: Entry = { title: t, list, addedAt: prev && prev.list === list ? prev.addedAt : Date.now() }
      api.putEntry(keyOf(t), entry).catch(reportSaveError)
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

  // adds titles that aren't in the library yet (used by the Trakt import later)
  const addMany = useCallback((entries: { title: Title; list: ListName }[]) => {
    const now = Date.now()
    const batch: Library = {}
    for (const e of entries) batch[keyOf(e.title)] = { ...e, addedAt: now }
    api.importData(batch, {}).catch(reportSaveError)
    setLibrary((l) => {
      const next = { ...l }
      for (const [k, e] of Object.entries(batch)) if (!next[k]) next[k] = e
      return next
    })
  }, [])

  return { library, ready, error, setList, remove, addMany }
}