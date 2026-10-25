import { useCallback, useEffect, useState } from 'react'
import type { Title } from './tmdb'

export type ListName = 'watchlist' | 'watched'
export type Library = Record<string, { title: Title; list: ListName }>

const KEY = 'screengrave:library'

export const keyOf = (t: Title) => `${t.type}-${t.id}`

function load(): Library {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<
      string,
      { title: Title; list: string }
    >
    const out: Library = {}
    for (const [k, v] of Object.entries(raw)) {
      // old "watching" entries become part of the watchlist
      out[k] = { title: v.title, list: v.list === 'watched' ? 'watched' : 'watchlist' }
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
    setLibrary((l) => ({ ...l, [keyOf(t)]: { title: t, list } }))
  }, [])

  const remove = useCallback((t: Title) => {
    setLibrary((l) => {
      const next = { ...l }
      delete next[keyOf(t)]
      return next
    })
  }, [])

  // adds titles that aren't in the library yet (used by the Trakt import next round)
  const addMany = useCallback((entries: { title: Title; list: ListName }[]) => {
    setLibrary((l) => {
      const next = { ...l }
      for (const e of entries) {
        if (!next[keyOf(e.title)]) next[keyOf(e.title)] = e
      }
      return next
    })
  }, [])

  return { library, setList, remove, addMany }
}