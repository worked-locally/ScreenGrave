import { useCallback, useEffect, useState } from 'react'
import type { Title } from './tmdb'

export type ListName = 'watchlist' | 'watched'
export type Library = Record<string, { title: Title; list: ListName; addedAt?: number }>

const KEY = 'screengrave:library'

export const keyOf = (t: Title) => `${t.type}-${t.id}`

function load(): Library {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<
      string,
      { title: Title; list: string; addedAt?: number }
    >
    const out: Library = {}
    for (const [k, v] of Object.entries(raw)) {
      out[k] = {
        title: v.title,
        list: v.list === 'watched' ? 'watched' : 'watchlist',
        addedAt: v.addedAt,
      }
    }
    return out
  } catch {
    return {}
  }
}

export function useLibrary() {
  const [library, setLibrary] = useState<Library>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(library))
  }, [library])

  const setList = useCallback((t: Title, list: ListName) => {
    setLibrary((l) => {
      const prev = l[keyOf(t)]
      const addedAt = prev && prev.list === list ? prev.addedAt : Date.now()
      return { ...l, [keyOf(t)]: { title: t, list, addedAt } }
    })
  }, [])

  const remove = useCallback((t: Title) => {
    setLibrary((l) => {
      const next = { ...l }
      delete next[keyOf(t)]
      return next
    })
  }, [])

  // adds titles that aren't in the library yet (used by the Trakt import later)
  const addMany = useCallback((entries: { title: Title; list: ListName }[]) => {
    setLibrary((l) => {
      const next = { ...l }
      for (const e of entries) {
        if (!next[keyOf(e.title)]) next[keyOf(e.title)] = { ...e, addedAt: Date.now() }
      }
      return next
    })
  }, [])

  return { library, setList, remove, addMany }
}