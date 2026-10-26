import { useEffect, useRef } from 'react'
import { useStatusOf } from '../lib/status'
import { img, type Title } from '../lib/tmdb'
import StatusBadge from './StatusBadge'

interface Props {
  items: Title[]
  onSelect: (t: Title) => void
}

const CARD = 150 // card width in px; change this one number to resize

export default function Carousel3D({ items, onSelect }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const statusOf = useStatusOf()

  // scale, fade and tilt each case based on how far it is from the center
  useEffect(() => {
    const el = track.current
    if (!el) return
    const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-card]'))
    let frame = 0

    const update = () => {
      frame = 0
      const center = el.scrollLeft + el.clientWidth / 2
      for (const card of cards) {
        const mid = card.offsetLeft + card.offsetWidth / 2
        const d = Math.min(Math.abs(center - mid) / card.offsetWidth, 1.6)
        const near = Math.min(d, 1)
        card.style.transform = `scale(${1 - near * 0.16})`
        card.style.opacity = String(1 - d * 0.3)
        card.style.setProperty('--tilt', `${10 + near * 20}deg`)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [items])

  // click-and-drag scrolling for mouse users
  useEffect(() => {
    const el = track.current
    if (!el) return
    let down = false
    let startX = 0
    let startScroll = 0

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      down = true
      dragged.current = false
      startX = e.clientX
      startScroll = el.scrollLeft
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      if (!dragged.current && Math.abs(dx) > 5) {
        dragged.current = true
        el.style.scrollSnapType = 'none'
        el.style.cursor = 'grabbing'
      }
      if (dragged.current) el.scrollLeft = startScroll - dx
    }
    const onUp = () => {
      if (!down) return
      down = false
      el.style.scrollSnapType = ''
      el.style.cursor = ''
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  function nudge(dir: 1 | -1) {
    const el = track.current
    if (!el) return
    const cards = el.querySelectorAll<HTMLElement>('[data-card]')
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : CARD + 16
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  const arrow =
    'absolute top-[38%] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-[#efe9df] backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 [@media(pointer:fine)]:flex'

  return (
    <div className="relative -mx-4">
      <button onClick={() => nudge(-1)} aria-label="Previous" className={`${arrow} left-2`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button onClick={() => nudge(1)} aria-label="Next" className={`${arrow} right-2`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div
        ref={track}
        onClickCapture={(e) => {
          if (dragged.current) {
            e.preventDefault()
            e.stopPropagation()
            dragged.current = false
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        className="no-scrollbar flex cursor-grab select-none snap-x snap-mandatory gap-4 overflow-x-auto pb-6 pt-2"
        style={{ paddingInline: `calc(50% - ${CARD / 2}px)` }}
      >
        {items.slice(0, 12).map((t) => (
          <button
            key={`${t.type}-${t.id}`}
            data-card
            onClick={() => onSelect(t)}
            className="block shrink-0 snap-center text-left will-change-transform"
            style={{ width: CARD }}
          >
            <div className="dvd w-full">
              <div className="dvd-case w-full">
                <div className="dvd-front w-full">
                  {t.poster ? (
                    <img
                      src={img(t.poster, 'w342') ?? ''}
                      alt={t.title}
                      draggable={false}
                      style={{ position: 'absolute', inset: 0 }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-[#8b8392]">
                      {t.title}
                    </div>
                  )}
                  <StatusBadge status={statusOf(t)} />
                </div>
                <div className="dvd-spine" />
              </div>
            </div>
            <p className="mt-4 truncate text-center text-sm font-medium">{t.title}</p>
            <p className="text-center text-xs text-[#8b8392]">
              {t.type === 'tv' ? 'Series' : 'Movie'}
              {t.year && ` · ${t.year}`}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}