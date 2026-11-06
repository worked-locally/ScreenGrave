import { useEffect, useRef, useState, type ReactNode } from 'react'
import FloatingSearch from '../components/FloatingSearch'
import ForYou from '../components/ForYou'
import PosterGrid from '../components/PosterGrid'
import ScreenTitle from '../components/ScreenTitle'
import ScrollRow from '../components/ScrollRow'
import type { Library } from '../lib/library'
import { REGIONS } from '../lib/settings'
import {
  discover,
  genres,
  getRegion,
  img,
  providers,
  search,
  type Filter,
  type Genre,
  type MediaType,
  type Provider,
  type Title,
} from '../lib/tmdb'

const MODE_KEY = 'screengrave:discover-mode'
type Mode = 'foryou' | 'browse'

function savedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'browse' ? 'browse' : 'foryou'
  } catch {
    return 'foryou'
  }
}

// "US" -> the US flag emoji
const flag = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))

const PER_ROW = 3
const ROWS_STEP = 6 // 6 full rows at a time

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
  label = 'All',
  active,
  onClick,
}: {
  name: string
  logo?: string | null
  label?: string // shown in the square when there's no logo
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
        {logo ? (
          <img src={img(logo, 'w154') ?? ''} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={label === 'All' ? '' : 'text-2xl'}>{label}</span>
        )}
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

interface Props {
  library: Library
  favoriteGenres: string[]
  onSelect: (t: Title) => void
  onOpenSettings: () => void
}

export default function Discover({ library, favoriteGenres, onSelect, onOpenSettings }: Props) {
  const [mode, setModeState] = useState<Mode>(savedMode)
  const modeRef = useRef<HTMLDivElement>(null)
  const setMode = (m: Mode) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // storage unavailable; it just won't be remembered
    }
  }

  // search
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Title[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const q = query.trim()

  // browse
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

  const key = `${type}:${filter.genre ?? 0}:${filter.provider ?? 0}`
  const loading = browse.key !== key

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
    if (mode !== 'browse') return
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
  }, [type, mode])

  useEffect(() => {
    if (mode !== 'browse') return
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
  }, [key, mode])

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

  // back up to the For You | Browse switch, so the filters are still in reach
  function toBrowse() {
    const el = modeRef.current
    // leave room for the status bar on iPhone plus a little breathing space
    const top = el ? el.getBoundingClientRect().top + window.scrollY - 72 : 0
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  const suggestions = q ? found.slice(0, 6) : []
  const showDropdown = open && suggestions.length > 0

  const shown = browse.items.slice(0, rows * PER_ROW)
  const canMore = !loading && (browse.items.length > shown.length || !browse.done)

  const region = getRegion()
  const country = REGIONS.find((r) => r.code === region)?.name ?? region
  const service = providerList.find((p) => p.id === filter.provider)
  const genre = genreList.find((g) => g.id === filter.genre)
  const where =
    filter.provider === 'region' ? `Popular in ${country}` : service ? `Popular on ${shortName(service.name)}` : 'Popular'
  const heading = `${where}${genre ? ` · ${genre.name}` : ''} · ${type === 'movie' ? 'Movies' : 'Series'}`

  return (
    <div>
      <ScreenTitle title="Discover" icon="discover" />

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
          <div ref={modeRef} className="mb-5 flex gap-6" role="tablist">
            {(['foryou', 'browse'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className="relative pb-1.5 text-lg font-semibold tracking-tight transition-colors"
                style={{ color: mode === m ? '#efe9df' : '#6b6473' }}
              >
                {m === 'foryou' ? 'For You' : 'Browse'}
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-opacity"
                  style={{ background: 'var(--accent)', opacity: mode === m ? 1 : 0 }}
                />
              </button>
            ))}
          </div>

          {mode === 'foryou' && (
            <ForYou library={library} genres={favoriteGenres} onSelect={onSelect} onPickGenres={onOpenSettings} />
          )}

          {mode === 'browse' && (
        <>
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
            <ServiceTile
              name={`In ${region}`}
              label={flag(region)}
              active={filter.provider === 'region'}
              onClick={() => setFilter((f) => ({ ...f, provider: 'region' }))}
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
        </>
      )}

      <FloatingSearch target={inputRef} onUp={q ? undefined : mode === 'browse' ? toBrowse : () => window.scrollTo({ top: 0, behavior: 'smooth' })} />
    </div>
  )
}