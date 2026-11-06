import { useEffect, useState } from 'react'
import { becauseYouWatched, seeds, topPicks } from '../lib/foryou'
import type { Library } from '../lib/library'
import { randomPhrase } from '../lib/phrases'
import { trending, type Title } from '../lib/tmdb'
import Carousel3D from './Carousel3D'
import Divider from './Divider'
import Poster from './Poster'
import ScrollRow from './ScrollRow'

interface Row {
  id: string
  lead: string // "Top picks in" / "Because you watched"
  name: string // the genre or title, in the accent color
  items: Title[]
}

const keyOf = (t: Title) => `${t.type}-${t.id}`

function PosterRow({ row, onSelect }: { row: Row; onSelect: (t: Title) => void }) {
  return (
    <section className="mb-6">
      <p className="mb-2 truncate text-sm font-semibold">
        {row.lead} <span style={{ color: 'var(--accent)' }}>{row.name}</span>
      </p>
      <ScrollRow bleed className="gap-3 px-4 pb-1">
        {row.items.map((t) => (
          <button
            key={keyOf(t)}
            onClick={() => onSelect(t)}
            className="w-[7.25rem] shrink-0 text-left transition-transform active:scale-95"
          >
            <Poster title={t} />
          </button>
        ))}
      </ScrollRow>
    </section>
  )
}

interface Props {
  library: Library
  genres: string[]
  onSelect: (t: Title) => void
  onPickGenres: () => void
}

export default function ForYou({ library, genres, onSelect, onPickGenres }: Props) {
  const [phrase] = useState(randomPhrase)
  const [hot, setHot] = useState<Title[]>([])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const genreKey = genres.join('|')

  // built once per visit (and when your genres change), skipping anything already in your library
  useEffect(() => {
    let cancelled = false
    const exclude = new Set(Object.keys(library))
    // three of your genres, a different mix each visit
    const picked = genreKey
      ? genreKey
          .split('|')
          .map((g) => ({ g, r: Math.random() }))
          .sort((a, b) => a.r - b.r)
          .slice(0, 3)
          .map((x) => x.g)
      : []
    const from = seeds(library)

    trending()
      .then((t) => {
        if (!cancelled) setHot(t.filter((x) => !exclude.has(keyOf(x))))
      })
      .catch((e) => setError(String(e)))

    Promise.all([
      Promise.all(picked.map((g) => topPicks(g, exclude).catch(() => [] as Title[]))),
      Promise.all(from.map((t) => becauseYouWatched(t, exclude).catch(() => [] as Title[]))),
    ]).then(([byGenre, bySeed]) => {
      if (cancelled) return
      const genreRows: Row[] = picked.map((g, i) => ({ id: `g-${g}`, lead: 'Top picks in', name: g, items: byGenre[i] }))
      const seedRows: Row[] = from.map((t, i) => ({ id: `s-${keyOf(t)}`, lead: 'Because you watched', name: t.title, items: bySeed[i] }))
      // alternate the two kinds so the page doesn't feel like a list of genres
      const mixed: Row[] = []
      for (let i = 0; i < Math.max(genreRows.length, seedRows.length); i++) {
        if (seedRows[i]) mixed.push(seedRows[i])
        if (genreRows[i]) mixed.push(genreRows[i])
      }
      // a title shows up in only one row
      const used = new Set<string>()
      const deduped = mixed
        .map((r) => ({ ...r, items: r.items.filter((t) => !used.has(keyOf(t)) && (used.add(keyOf(t)), true)) }))
        .filter((r) => r.items.length >= 3)
      setRows(deduped)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreKey])

  return (
    <>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <p className="mb-1 text-xs uppercase tracking-widest text-[#8b8392]">Trending this week</p>
      <Carousel3D items={hot} onSelect={onSelect} />

      <Divider text={phrase} />

      {!genres.length && (
        <button onClick={onPickGenres} className="mb-6 w-full rounded-2xl bg-[#1f1a24] px-4 py-3.5 text-left">
          <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
            Pick your favorite genres
          </span>
          <span className="mt-0.5 block text-xs text-[#8b8392]">Get top picks for the kinds of shows and movies you like.</span>
        </button>
      )}

      {rows === null ? (
        <p className="mt-10 text-center text-sm text-[#8b8392]">Finding picks for you…</p>
      ) : rows.length === 0 ? (
        genres.length > 0 && (
          <p className="mt-10 text-center text-sm text-[#8b8392]">No picks right now. Try again later.</p>
        )
      ) : (
        rows.map((r) => <PosterRow key={r.id} row={r} onSelect={onSelect} />)
      )}
    </>
  )
}
