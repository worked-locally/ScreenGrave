import { useEffect, useRef, useState } from 'react'
import PosterGrid from '../components/PosterGrid'
import { img, search, trending, type Title } from '../lib/tmdb'

export default function Discover({ onSelect }: { onSelect: (t: Title) => void }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Title[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const q = query.trim()

  useEffect(() => {
    let cancelled = false
    const term = query.trim()
    const timer = setTimeout(
      () => {
        const req = term ? search(term) : trending()
        req
          .then((r) => {
            if (cancelled) return
            setItems(r)
            setError('')
          })
          .catch((e) => {
            if (!cancelled) setError(String(e))
          })
      },
      term ? 250 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const suggestions = q ? items.slice(0, 6) : []
  const showDropdown = open && suggestions.length > 0

function pick(t: Title) {
  setOpen(false)
  inputRef.current?.blur()
  onSelect(t)
}

  return (
    <div>
      <h2 className="mb-5 text-2xl font-semibold tracking-tight">Discover</h2>

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

      {!q && <p className="mb-3 text-xs uppercase tracking-widest text-[#8b8392]">Trending</p>}
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <PosterGrid items={items} onSelect={onSelect} empty="No results." />
    </div>
  )
}