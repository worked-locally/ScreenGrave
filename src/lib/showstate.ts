import { useContext, useEffect, useSyncExternalStore } from 'react'
import { keyOf } from './library'
import { StatusContext } from './status'
import { fetchInfo, type Info, type ShowState, type Title } from './tmdb'

// Whether a show is still running, remembered for shows you've opened but don't track.
// (Shows in your library get this from their regular background lookup.)

interface Known {
  state: ShowState
  next: string | null // next episode date, YYYY-MM-DD
  release: string // first air date
  at: number
}

const KEY = 'screengrave:showstate:v1'
const TTL = 6 * 60 * 60 * 1000
const MAX = 300 // keep the newest few hundred

function load(): Record<string, Known> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Known>
  } catch {
    return {}
  }
}

let known = load()
const listeners = new Set<() => void>()

function remember(key: string, i: Info) {
  if (!i.state) return
  const next = { ...known, [key]: { state: i.state, next: i.next?.date ?? null, release: i.release, at: Date.now() } }
  const keys = Object.keys(next)
  if (keys.length > MAX) keys.sort((a, b) => next[a].at - next[b].at).slice(0, keys.length - MAX).forEach((k) => delete next[k])
  known = next
  try {
    localStorage.setItem(KEY, JSON.stringify(known))
  } catch {
    // storage full or unavailable; it just won't be remembered
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

// what a poster knows about a show, without looking anything up
export function useShowState(t: Title): Known | null {
  const { info } = useContext(StatusContext)
  const all = useSyncExternalStore(subscribe, () => known)
  if (t.type !== 'tv') return null
  const key = keyOf(t)
  const i = info[key]
  if (i?.state) return { state: i.state, next: i.next?.date ?? null, release: i.release, at: i.fetchedAt }
  return all[key] ?? null
}

// the detail sheet: looks the show up once if nothing is known yet (or it's old)
export function useShowStateLookup(t: Title): Known | null {
  const current = useShowState(t)
  const at = current?.at ?? 0
  useEffect(() => {
    if (t.type !== 'tv' || Date.now() - at < TTL) return
    let cancelled = false
    fetchInfo(t)
      .then((i) => !cancelled && remember(keyOf(t), i))
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.type, t.id, at])
  return current
}
