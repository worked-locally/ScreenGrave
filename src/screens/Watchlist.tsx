import { useEffect, useRef, useState } from 'react'
import Divider from '../components/Divider'
import Poster from '../components/Poster'
import ScreenTitle from '../components/ScreenTitle'
import type { useEpisodes } from '../lib/episodes'
import { keyOf, type Library } from '../lib/library'
import type { Info, Title } from '../lib/tmdb'

const PHRASES = ['Intermission', 'Popcorn break', 'Plot twist ahead', 'Cue the credits', 'Lights, camera, snacks']
const VISIBLE_ROWS = 3

interface Item {
  t: Title
  aired: number
  seen: number
  behind: boolean
}

interface Props {
  library: Library
  info: Record<string, Info>
  ep: ReturnType<typeof useEpisodes>
  onSelect: (t: Title) => void
}

function Section({
  id,
  label,
  items,
  empty,
  onSelect,
}: {
  id: string
  label: string
  items: Item[]
  empty: string
  onSelect: (t: Title) => void
}) {
  const storeKey = `screengrave:collapsed:${id}`
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(storeKey) === '1')
  const [maxHeight, setMaxHeight] = useState<number | null>(null)
  const grid = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(storeKey, collapsed ? '1' : '0')
  }, [collapsed, storeKey])

  // cap the box at three rows of posters, then let it scroll
  useEffect(() => {
    const el = grid.current
    if (!el) return
    const measure = () => {
      const tops = [...new Set(Array.from(el.children).map((c) => (c as HTMLElement).offsetTop))].sort(
        (a, b) => a - b,
      )
      setMaxHeight(tops.length > VISIBLE_ROWS ? tops[VISIBLE_ROWS] + 18 : null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items.length])

  return (
    <section className="overflow-hidden rounded-2xl bg-[#16131a]">
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#8b8392]"
      >
        <span>
          {label} <span className="tabular-nums">({items.length})</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 transition-transform duration-300"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'none' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="relative overflow-y-auto overscroll-contain [scrollbar-color:#3a3340_transparent] [scrollbar-width:thin]"
            style={{ maxHeight: maxHeight ?? undefined }}
          >
            {items.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-[#8b8392]">{empty}</p>
            ) : (
              <div ref={grid} className="grid grid-cols-3 items-start gap-3 px-3 pb-3">
                {items.map(({ t, aired, seen, behind }) => (
                  <button
                    key={keyOf(t)}
                    onClick={() => onSelect(t)}
                    className="text-left transition-transform active:scale-95"
                  >
                    <Poster title={t} />
                    {behind && (
                      <div className="mt-2">
                        <div className="h-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(seen / aired) * 100}%`, background: 'var(--accent)' }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] tabular-nums text-[#8b8392]">
                          {seen} / {aired} eps
                        </p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Watchlist({ library, info, ep, onSelect }: Props) {
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)])

  const items: Item[] = Object.values(library)
    .filter((e) => e.list === 'watchlist')
    .map((e) => {
      const t = e.title
      const aired = info[keyOf(t)]?.aired ?? 0
      const seen = t.type === 'tv' ? Math.min(ep.count(keyOf(t)), aired) : 0
      return { t, aired, seen, behind: t.type === 'tv' && aired > seen }
    })

  const movies = items
    .filter((i) => i.t.type === 'movie')
    .sort((a, b) => a.t.title.localeCompare(b.t.title))
  // shows you're behind on come first
  const shows = items
    .filter((i) => i.t.type === 'tv')
    .sort((a, b) => Number(b.behind) - Number(a.behind) || a.t.title.localeCompare(b.t.title))

  return (
    <div>
      <ScreenTitle title="Watchlist" count={items.length} />

      <Section id="movies" label="Movies" items={movies} empty="No movies yet. Add some from Discover." onSelect={onSelect} />
      <Divider text={phrase} />
      <Section id="tv" label="TV Shows" items={shows} empty="No shows yet. Add some from Discover." onSelect={onSelect} />
    </div>
  )
}