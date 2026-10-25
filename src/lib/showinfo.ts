import { useEffect, useState } from 'react'
import { keyOf } from './library'
import { fetchInfo, type Info, type Title } from './tmdb'

const KEY = 'screengrave:info'
const TTL = 6 * 60 * 60 * 1000

function load(): Record<string, Info> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function useShowInfo(titles: Title[]) {
  const [info, setInfo] = useState<Record<string, Info>>(load)
  const ids = titles.map(keyOf).sort().join(',')

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(info))
  }, [info])

  useEffect(() => {
    let cancelled = false
    const cache = load()
    const stale = titles.filter((t) => {
      const i = cache[keyOf(t)]
      return !i || Date.now() - i.fetchedAt > TTL
    })

    let next = 0
    async function worker() {
      while (!cancelled && next < stale.length) {
        const t = stale[next++]
        try {
          const i = await fetchInfo(t)
          if (!cancelled) setInfo((cur) => ({ ...cur, [keyOf(t)]: i }))
        } catch {
          // skip; it will retry next time
        }
      }
    }
    for (let n = 0; n < Math.min(6, stale.length); n++) void worker()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  return info
}