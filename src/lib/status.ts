import { createContext, useContext } from 'react'
import { keyOf, type Library } from './library'
import type { Info, Title } from './tmdb'

export type Status = 'watched' | 'watching' | 'upcoming' | 'ready'

interface Ctx {
  library: Library
  info: Record<string, Info>
  count: (show: string) => number
}

export const StatusContext = createContext<Ctx>({ library: {}, info: {}, count: () => 0 })

const todayStr = () => new Date().toLocaleDateString('en-CA')

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