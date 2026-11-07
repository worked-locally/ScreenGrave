import { createContext, useContext } from 'react'
import { todayStr } from './dates'
import { keyOf, type Library } from './library'
import type { Info, Title } from './tmdb'

export type Status = 'watched' | 'watching' | 'upcoming' | 'ready'

interface Ctx {
  library: Library
  info: Record<string, Info>
  count: (show: string) => number
}

export const StatusContext = createContext<Ctx>({ library: {}, info: {}, count: () => 0 })


export function useStatusOf() {
  const { library, info, count } = useContext(StatusContext)

  return (t: Title): Status | null => {
    const key = keyOf(t)
    const entry = library[key]
    if (!entry) return null
    if (entry.list === 'watched') return 'watched'

    const i = info[key]
    if (t.type === 'tv') {
      if (count(key) > 0) return 'watching'
      if (i && i.aired === 0) return 'upcoming'
      return 'ready'
    }
    if (i?.next && i.next.date > todayStr()) return 'upcoming'
    return 'ready'
  }
}

// the date a not-yet-released title comes out, if TMDB knows it
export function useReleaseDate() {
  const { info } = useContext(StatusContext)

  return (t: Title): string | null => {
    const i = info[keyOf(t)]
    const date = i?.release || i?.next?.date || ''
    return date && date > todayStr() ? date : null
  }
}