import { useRef, useState } from 'react'
import FloatingSearch from '../components/FloatingSearch'
import Poster from '../components/Poster'
import ScreenTitle from '../components/ScreenTitle'
import ScrollRow from '../components/ScrollRow'
import { keyOf, type Library } from '../lib/library'
import type { Title } from '../lib/tmdb'

type Sort = 'year-desc' | 'year-asc' | 'title' | 'rating' | 'recent'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'year-desc', label: 'Newest' },
  { id: 'year-asc', label: 'Oldest' },
  { id: 'title', label: 'A–Z' },
  { id: 'rating', label: 'Top rated' },
  { id: 'recent', label: 'Recently watched' },
]

const yr = (t: Title) => Number(t.year) || 0

interface Props {
  library: Library
  onSelect: (t: Title) => void
}

export default function Watched({ library, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('year-desc')
  const inputRef = useRef<HTMLInputElement>(null)

  const all = Object.values(library).filter((e) => e.list === 'watched')
  const q = query.trim().toLowerCase()
  const shown = all.filter((e) => !q || e.title.title.toLowerCase().includes(q))

  const sorted = [...shown].sort((a, b) => {
    const A = a.title
    const B = b.title
    switch (sort) {
      case 'year-desc':
        return yr(B) - yr(A) || A.title.localeCompare(B.title)
      case 'year-asc':
        return (yr(A) || 9999) - (yr(B) || 9999) || A.title.localeCompare(B.title)
      case 'title':
        return A.title.localeCompare(B.title)
      case 'rating':
        return B.rating - A.rating || A.title.localeCompare(B.title)
      case 'recent':
        return (b.addedAt ?? 0) - (a.addedAt ?? 0) || A.title.localeCompare(B.title)
    }
  })

  // year headers only when sorting by year
  const byYear = sort === 'year-desc' || sort === 'year-asc'
  const groups: { label: string; items: Title[] }[] = []
  for (const e of sorted) {
    const label = byYear ? e.title.year || 'Unknown' : ''
    const g = groups[groups.length - 1]
    if (g && g.label === label) g.items.push(e.title)
    else groups.push({ label, items: [e.title] })
  }

  return (
    <div>
      <ScreenTitle title="Watched" count={all.length} icon="watched" />

      <div className="relative mb-3">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search watched"
          enterKeyHint="search"
          autoComplete="off"
          className="w-full rounded-2xl bg-[#1f1a24] px-4 py-3 pr-10 text-base outline-none placeholder:text-[#8b8392]"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b8392]"
          >
            ✕
          </button>
        )}
      </div>

      <ScrollRow className="mb-4 gap-2 pb-1">
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium"
            style={
              sort === s.id
                ? { background: 'var(--accent)', color: '#1a1008' }
                : { background: '#1f1a24', color: '#8b8392' }
            }
          >
            {s.label}
          </button>
        ))}
      </ScrollRow>

      {all.length === 0 && (
        <p className="mt-16 text-center text-sm text-[#8b8392]">
          Nothing watched yet. Mark titles as Watched from their detail sheet.
        </p>
      )}
      {all.length > 0 && groups.length === 0 && (
        <p className="mt-16 text-center text-sm text-[#8b8392]">No matches for “{query.trim()}”.</p>
      )}

      {groups.map((g) => (
        <section key={g.label || 'all'} className="mb-4">
          {g.label && (
            <h3
              className="sticky z-[5] -mx-4 mb-3 bg-[#0c0a0f]/90 px-4 py-2 text-sm font-semibold tracking-wide tabular-nums backdrop-blur"
              style={{ top: 'env(safe-area-inset-top)' }}
            >
              {g.label}
            </h3>
          )}
          <div className="grid grid-cols-3 items-start gap-3">
            {g.items.map((t) => (
              <button
                key={keyOf(t)}
                onClick={() => onSelect(t)}
                className="text-left transition-transform active:scale-95"
              >
                <Poster title={t} />
              </button>
            ))}
          </div>
        </section>
      ))}

      <FloatingSearch target={inputRef} onUp={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
    </div>
  )
}