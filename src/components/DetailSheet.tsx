import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBodyLock } from '../lib/bodyLock'
import type { useEpisodes } from '../lib/episodes'
import type { ListName } from '../lib/library'
import { img, titleGenres, type Title } from '../lib/tmdb'
import EpisodeTracker from './EpisodeTracker'
import TrailerButton from './TrailerButton'

interface Props {
  title: Title
  current?: ListName
  onClose: () => void
  onSet: (list: ListName) => void
  onRemove: () => void
  ep: ReturnType<typeof useEpisodes>
}

// the overview, cut to 4 lines with "Read more" when it's long
function Overview({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [long, setLong] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (el && !open) setLong(el.scrollHeight > el.clientHeight + 1)
  }, [text, open])

  const cut = long && !open
  return (
    <div className="mt-4">
      <p
        ref={ref}
        className={`text-sm leading-relaxed text-[#cdc6bd] ${open ? '' : 'line-clamp-4'}`}
        style={
          cut
            ? {
                maskImage: 'linear-gradient(to bottom, #000 60%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, #000 60%, transparent)',
              }
            : undefined
        }
      >
        {text}
      </p>
      {long && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-sm font-medium"
          style={{ color: 'var(--accent)' }}
          aria-expanded={open}
        >
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

const LISTS: { id: ListName; label: string }[] = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watched', label: 'Watched' },
]

export default function DetailSheet({ title, current, onClose, onSet, onRemove, ep }: Props) {
  const backdrop = img(title.backdrop, 'w780')
  const [notice, setNotice] = useState('')
  const [genreNames, setGenreNames] = useState<string[]>([])
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useBodyLock()

  useEffect(() => {
    let cancelled = false
    titleGenres(title.type, title.id)
      .then((g) => {
        if (!cancelled) setGenreNames(g)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [title.type, title.id])

  function flash(message: string) {
    setNotice(message)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setNotice(''), 2200)
  }

  function toggle(list: ListName, label: string) {
    if (current === list) {
      onRemove()
      flash(`Removed from ${label}`)
    } else {
      onSet(list)
      setNotice('')
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <div className="anim-fade touch-none absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div
        className="anim-sheet relative max-h-[88%] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-[#16131a]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <div className="sticky top-0 z-10 h-0">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-[#efe9df] backdrop-blur-sm transition-transform active:scale-90"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="h-5 w-5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        
        {backdrop && (
          <div className="relative h-40 overflow-hidden rounded-t-3xl">
            <img src={backdrop} alt="" className="h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#16131a] to-transparent" />
          </div>
        )}
        <div className="px-5 pt-4">
          <div className="flex gap-4">
            {title.poster && (
              <img
                src={img(title.poster) ?? ''}
                alt={title.title}
                className={`w-24 shrink-0 rounded-xl ${backdrop ? '-mt-14' : ''}`}
              />
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight">{title.title}</h2>
              <p className="mt-1 text-sm text-[#8b8392]">
                {title.type === 'tv' ? 'Series' : 'Movie'}
                {title.year && ` · ${title.year}`}
              </p>
            </div>
          </div>

          {title.overview && <Overview key={`${title.type}-${title.id}`} text={title.overview} />}

          {genreNames.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {genreNames.map((g) => (
                <span key={g} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#cdc6bd]">
                  {g}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <TrailerButton title={title} />
            {title.rating > 0 && (
              <span
                className="ml-auto flex items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-2 text-sm font-semibold tabular-nums"
                title="Audience rating (TMDB)"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="var(--accent)">
                  <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
                </svg>
                {title.rating.toFixed(1)}
                <span className="text-xs font-normal text-[#8b8392]">/10</span>
              </span>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            {LISTS.map((l) => {
              const active = current === l.id
              return (
                <button
                  key={l.id}
                  onClick={() => toggle(l.id, l.label)}
                  className="rounded-xl py-3 text-sm font-medium transition-all active:scale-95"
                  style={
                    active
                      ? { background: l.id === 'watched' ? 'var(--done)' : 'var(--accent)', color: '#1a1008' }
                      : { background: '#1f1a24', color: '#cdc6bd' }
                  }
                >
                  {l.label}
                  {active && <span className="ml-1.5 text-[11px] font-semibold opacity-75">(Added)</span>}
                </button>
              )
            })}
          </div>

          <p key={notice} className="anim-fade mt-2 h-4 text-center text-xs text-[#8b8392]">
            {notice}
          </p>

          {title.type === 'tv' && (
            <EpisodeTracker
              show={title}
              ep={ep}
              onActivity={() => {
                if (!current) onSet('watchlist')
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}