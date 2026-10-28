import { useEffect, useRef, useState, type ReactNode } from 'react'
import Carousel3D from '../components/Carousel3D'
import Divider from '../components/Divider'
import PosterGrid from '../components/PosterGrid'
import ScreenTitle from '../components/ScreenTitle'
import ScrollRow from '../components/ScrollRow'
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

const PER_ROW = 3
const ROWS_STEP = 6 // 6 full rows at a time
const PHRASES = ['Coming attractions', 'Now showing', 'Feature presentation', 'Previews']

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
  const browseRef = useRef<HTMLDivElement>(null)
  const q = query.trim()

  // carousel + browse
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)])
  const [hot, setHot] = useState<Title[]>([])
  const [type, setType] = useState<MediaType>('movie')
  const [filter, setFilter] = useState<Filter>({ genre: null, provider: null })
  const [genreList, setGenreList] = useState<Genre[]>([])
  const [providerList, setProviderList] = useState<Provider[]>([])
  const [browse, setBrowse] = useState<{ key: string; items: Title[]; page: number; done: boolean }>({
    key: '',
    items: [],
    page: 0,
    done: false,
  })
  const [rows, setRows] = useState(ROWS_STEP)
  const [more, setMore] = useState(false)
  const [atBottom, setAtBottom] = useState(false)

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
        if (cancelled) return
        setBrowse({ key, items, page: 1, done: items.length === 0 })
        setRows(ROWS_STEP)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // show the scroll-up button only when the page is scrolled all the way down
  useEffect(() => {
    const check = () => {
      const doc = document.documentElement
      setAtBottom(window.scrollY > 400 && window.innerHeight + window.scrollY >= doc.scrollHeight - 200)
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    const ro = new ResizeObserver(check)
    ro.observe(document.body)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      ro.disconnect()
    }
  }, [])

  async function loadMore() {
    const want = (rows + ROWS_STEP) * PER_ROW
    setMore(true)
    try {
      let { items, page, done } = browse
      while (!done && items.length < want) {
        const r = await discover(type, filter, page + 1)
        page += 1
        if (r.length === 0) {
          done = true
          break
        }
        const seen = new Set(items.map((t) => t.id))
        items = [...items, ...r.filter((t) => !seen.has(t.id))]
      }
      setBrowse((b) => (b.key === key ? { key, items, page, done } : b))
      setRows((r) => r + ROWS_STEP)
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

  function focusSearch() {
    inputRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // back up to the divider, so the Movies / Series switch is still in reach
  function toBrowse() {
    const el = browseRef.current
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const suggestions = q ? found.slice(0, 6) : []
  const showDropdown = open && suggestions.length > 0

  const shown = browse.items.slice(0, rows * PER_ROW)
  const canMore = !loading && (browse.items.length > shown.length || !browse.done)

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
        <PosterGrid items={found.slice(0, ROWS_STEP * PER_ROW)} onSelect={onSelect} empty="No results." />
      ) : (
        <>
          <p className="mb-1 text-xs uppercase tracking-widest text-[#8b8392]">Trending this week</p>
          <Carousel3D items={hot} onSelect={onSelect} />

          <div ref={browseRef} className="scroll-mt-6">
            <Divider text={phrase} />
          </div>

          <p className="mb-3 text-xs uppercase tracking-widest text-[#8b8392]">Browse</p>

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
          <ScrollRow bleed className="mb-5 gap-1 px-4 py-1">
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
          </ScrollRow>

          <p className="mb-2 text-sm font-semibold">Genres</p>
          <ScrollRow bleed className="mb-6 gap-2 px-4 pb-1">
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
          </ScrollRow>

          <p className="mb-3 text-xs uppercase tracking-widest text-[#8b8392]">{heading}</p>

          <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            <PosterGrid items={shown} onSelect={onSelect} empty={loading ? 'Loading…' : 'No results.'} />
          </div>

          {canMore && (
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

      {/* floating buttons, aligned to the right edge of the content column */}
      <div
        className="pointer-events-none fixed inset-x-0 z-[9]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
      >
        <div className="mx-auto flex max-w-xl justify-end gap-3 px-4">
          {atBottom && !q && (
            <button
              onClick={toBrowse}
              aria-label="Back to browse filters"
              className="anim-fade pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#1f1a24]/95 text-[#efe9df] shadow-lg shadow-black/50 backdrop-blur transition-transform active:scale-90"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
          <button
            onClick={focusSearch}
            aria-label="Search"
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full shadow-lg shadow-black/50 transition-transform active:scale-90"
            style={{ background: 'var(--accent)', color: '#1a1008' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}