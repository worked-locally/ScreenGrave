import { useEffect, useRef, useState } from 'react'
import type { useEpisodes } from '../lib/episodes'
import type { ListName } from '../lib/library'
import { img, type Title } from '../lib/tmdb'
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

const LISTS: { id: ListName; label: string }[] = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watched', label: 'Watched' },
]

export default function DetailSheet({ title, current, onClose, onSet, onRemove, ep }: Props) {
  const backdrop = img(title.backdrop, 'w780')
  const [notice, setNotice] = useState('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])
    // lock page scrolling while the sheet is open
  useEffect(() => {
    const html = document.documentElement
    const prevHtml = html.style.overflow
    const prevBody = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [])

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
                {title.rating > 0 && ` · ★ ${title.rating}`}
              </p>
            </div>
          </div>

          {title.overview && (
            <p className="mt-4 text-sm leading-relaxed text-[#cdc6bd]">{title.overview}</p>
          )}

          <TrailerButton title={title} />

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