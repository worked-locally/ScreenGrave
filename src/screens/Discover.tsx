import { useEffect, useRef, useState, type ReactNode } from 'react'
import Carousel3D from '../components/Carousel3D'
import PosterGrid from '../components/PosterGrid'
import ScreenTitle from '../components/ScreenTitle'
import {
  discover,
  genres,
  img,
  providers,
  search,
  trending,
  type Filter,
  type Genre,
  type MediaType,
  type Provider,
  type Title,
} from '../lib/tmdb'

// "Amazon Prime Video" -> "Prime Video", "Disney Plus" -> "Disney+", "Peacock Premium" -> "Peacock"
const shortName = (n: string) => n.replace(/^amazon /i, '').replace(/ plus$/i, '+').replace(/ premium$/i, '')

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors"
      style={active ? { background: 'var(--accent)', color: '#1a1008' } : { background: '#1f1a24', color: '#cdc6bd' }}
    >
      {children}
    </button>
  )
}

function ServiceTile({
  name,
  logo,
  active,
  onClick,
}: {
  name: string
  logo?: string | null
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
    >
      <span
        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[#1f1a24] text-sm font-semibold text-[#cdc6bd]"
        style={{ boxShadow: active ? '0 0 0 2px var(--accent)' : '0 0 0 2px transparent' }}
      >
        {logo ? <img src={img(logo, 'w154') ?? ''} alt="" className="h-full w-full object-cover" /> : 'All'}
      </span>
      <span
        className="w-full truncate text-center text-[11px]"
        style={{ color: active ? 'var(--accent)' : '#8b8392' }}
      >
        {name}
      </span>
    </button>
  )
}

export default function Discover({ onSelect }: { onSelect: (t: Title) => void }) {
  // search
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Title[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const q = query.trim()

  // carousel + browse
  const [hot, setHot] = useState<Title[]>([])
  const [type, setType] = useState<MediaType>('movie')
  const [filter, setFilter] = useState<Filter>({ genre: null, provider: null })
  const [genreList, setGenreList] = useState<Genre[]>([])
  const [providerList, setProviderList] = useState<Provider[]>([])
  const [browse, setBrowse] = useState<{ key: string; items: Title[]; page: number }>({
    key: '',
    items: [],
    page: 1,
  })
  const [more, setMore] = useState(false)

  const key = `${type}:${filter.genre ?? 0}:${filter.provider ?? 0}`
  const loading = browse.key !== key

  useEffect(() => {
    trending()
      .then(setHot)
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    let cancelled = false
    const term = query.trim()
    if (!term) return
    const timer = setTimeout(() => {
      search(term)
        .then((r) => {
          if (cancelled) return
          setFound(r)
          setError('')
        })
        .catch((e) => {
          if (!cancelled) setError(String(e))
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    let cancelled = false
    Promise.all([genres(type), providers(type)])
      .then(([g, p]) => {
        if (cancelled) return
        setGenreList(g)
        setProviderList(p)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [type])

  useEffect(() => {
    let cancelled = false
    discover(type, filter, 1)
      .then((items) => {
        if (!cancelled) setBrowse({ key, items, page: 1 })
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function loadMore() {
    setMore(true)
    try {
      const r = await discover(type, filter, browse.page + 1)
      setBrowse((b) => {
        if (b.key !== key) return b
        const seen = new Set(b.items.map((t) => t.id))
        return { ...b, items: [...b.items, ...r.filter((t) => !seen.has(t.id))], page: b.page + 1 }
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setMore(false)
    }
  }

  function pick(t: Title) {
    setOpen(false)
    inputRef.current?.blur()
    onSelect(t)
  }

  const suggestions = q ? found.slice(0, 6) : []
  const showDropdown = open && suggestions.length > 0

  const service = providerList.find((p) => p.id === filter.provider)
  const genre = genreList.find((g) => g.id === filter.genre)
  const heading = `${service ? `Popular on ${shortName(service.name)}` : 'Popular'}${genre ? ` · ${genre.name}` : ''} · ${
    type === 'movie' ? 'Movies' : 'Series'
  }`

  return (
    <div>
      <ScreenTitle title="Discover" />

      <div className="relative mb-5">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setOpen(false)
              e.currentTarget.blur()
            }
          }}
          placeholder="Search shows and movies"
          enterKeyHint="search"
          autoComplete="off"
          className="w-full rounded-2xl bg-[#1f1a24] px-4 py-3 pr-10 text-base outline-none placeholder:text-[#8b8392]"
        />

        {query && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('')
              setOpen(false)
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b8392]"
          >
            ✕
          </button>
        )}

        {showDropdown && (
          <ul
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-2xl bg-[#1f1a24] shadow-xl shadow-black/50"
          >
            {suggestions.map((s) => (
              <li key={`${s.type}-${s.id}`}>
                <button
                  onClick={() => pick(s)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-white/5"
                >
                  {s.poster ? (
                    <img src={img(s.poster) ?? ''} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-8 shrink-0 rounded bg-[#262029]" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{s.title}</span>
                    <span className="block text-xs text-[#8b8392]">
                      {s.type === 'tv' ? 'Series' : 'Movie'}
                      {s.year && ` · ${s.year}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {q ? (
        <PosterGrid items={found} onSelect={onSelect} empty="No results." />
      ) : (
        <>
          <p className="mb-1 text-xs uppercase tracking-widest text-[#8b8392]">Trending this week</p>
          <Carousel3D items={hot} onSelect={onSelect} />

          <p className="mb-3 mt-4 text-xs uppercase tracking-widest text-[#8b8392]">Browse</p>

          <div className="mb-5 inline-flex rounded-full bg-[#1f1a24] p-1">
            {(['movie', 'tv'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setType(t)
                  setFilter((f) => ({ ...f, genre: null }))
                }}
                className="rounded-full px-5 py-1.5 text-sm font-medium transition-colors"
                style={type === t ? { background: 'var(--accent)', color: '#1a1008' } : { color: '#8b8392' }}
              >
                {t === 'movie' ? 'Movies' : 'Series'}
              </button>
            ))}
          </div>

          <p className="mb-2 text-sm font-semibold">Streaming</p>
          <div className="no-scrollbar -mx-4 mb-5 flex gap-1 overflow-x-auto px-4 py-1">
            <ServiceTile
              name="All"
              active={filter.provider === null}
              onClick={() => setFilter((f) => ({ ...f, provider: null }))}
            />
            {providerList.map((p) => (
              <ServiceTile
                key={p.id}
                name={shortName(p.name)}
                logo={p.logo}
                active={filter.provider === p.id}
                onClick={() => setFilter((f) => ({ ...f, provider: p.id }))}
              />
            ))}
          </div>

          <p className="mb-2 text-sm font-semibold">Genres</p>
          <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={filter.genre === null} onClick={() => setFilter((f) => ({ ...f, genre: null }))}>
              All
            </Chip>
            {genreList.map((g) => (
              <Chip
                key={g.id}
                active={filter.genre === g.id}
                onClick={() => setFilter((f) => ({ ...f, genre: g.id }))}
              >
                {g.name}
              </Chip>
            ))}
          </div>

          <p className="mb-3 text-xs uppercase tracking-widest text-[#8b8392]">{heading}</p>

          <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            <PosterGrid items={browse.items} onSelect={onSelect} empty={loading ? 'Loading…' : 'No results.'} />
          </div>

          {browse.items.length > 0 && !loading && (
            <button
              onClick={loadMore}
              disabled={more}
              className="mx-auto mt-6 block rounded-full bg-[#1f1a24] px-6 py-2.5 text-sm font-medium text-[#cdc6bd] transition-transform active:scale-95 disabled:opacity-50"
            >
              {more ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}