import { useEffect, useRef } from 'react'
import { useStatusOf } from '../lib/status'
import { img, type Title } from '../lib/tmdb'
import StatusBadge from './StatusBadge'

interface Props {
  items: Title[]
  onSelect: (t: Title) => void
}

const CARD = 150 // card width in px; change this one number to resize
const MAX = 12

export default function Carousel3D({ items, onSelect }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const pressing = useRef(false)
  const statusOf = useStatusOf()

  const base = items.slice(0, MAX)
  const n = base.length
  // three copies side by side; we quietly jump back to the middle copy when scrolling stops
  const loop = [...base, ...base, ...base]

  // scale, fade and tilt each case by its distance from the center, and keep the loop seamless
  useEffect(() => {
    const el = track.current
    if (!el || n === 0) return
    const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-card]'))
    const looped = cards.length === n * 3
    let frame = 0
    let timer = 0

    const centerOf = (c: HTMLElement) => c.offsetLeft + c.offsetWidth / 2

    const visuals = () => {
      frame = 0
      const mid = el.scrollLeft + el.clientWidth / 2
      for (const card of cards) {
        const d = Math.min(Math.abs(mid - centerOf(card)) / card.offsetWidth, 1.6)
        const near = Math.min(d, 1)
        card.style.transform = `scale(${1 - near * 0.16})`
        card.style.opacity = String(1 - d * 0.3)
        card.style.setProperty('--tilt', `${10 + near * 20}deg`)
      }
    }

    const wrap = () => {
      if (!looped || pressing.current) return
      const mid = el.scrollLeft + el.clientWidth / 2
      let nearest = 0
      let best = Infinity
      cards.forEach((c, i) => {
        const dist = Math.abs(centerOf(c) - mid)
        if (dist < best) {
          best = dist
          nearest = i
        }
      })
      const setWidth = centerOf(cards[n]) - centerOf(cards[0])
      const delta = nearest < n ? setWidth : nearest >= 2 * n ? -setWidth : 0
      if (!delta) return
      el.style.scrollSnapType = 'none'
      el.scrollLeft += delta
      requestAnimationFrame(() => {
        el.style.scrollSnapType = ''
        visuals()
      })
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(visuals)
      window.clearTimeout(timer)
      timer = window.setTimeout(wrap, 140)
    }

    // start on the first card of the middle copy
    if (looped) el.scrollLeft = centerOf(cards[n]) - el.clientWidth / 2
    visuals()

    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [items, n])

  // after 3 seconds without interaction, give the row a little swipe so people know it moves
  useEffect(() => {
    const el = track.current
    if (!el || n === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const host = el.parentElement ?? el
    let stopped = false
    let raf = 0
    const timers: number[] = []

    const swipe = () => {
      const r = el.getBoundingClientRect()
      if (stopped || pressing.current || r.bottom < 0 || r.top > window.innerHeight) return
      const start = el.scrollLeft
      const t0 = performance.now()
      const DURATION = 1200
      el.style.scrollSnapType = 'none'
      const step = (now: number) => {
        const p = Math.min((now - t0) / DURATION, 1)
        el.scrollLeft = start + Math.sin(p * Math.PI) * 80
        if (p < 1 && !stopped) {
          raf = requestAnimationFrame(step)
        } else {
          el.style.scrollSnapType = ''
        }
      }
      raf = requestAnimationFrame(step)
    }

    const stop = () => {
      stopped = true
      cancelAnimationFrame(raf)
      timers.forEach((t) => window.clearTimeout(t))
      el.style.scrollSnapType = ''
    }

    ;[3000, 10000, 17000].forEach((ms) => timers.push(window.setTimeout(swipe, ms)))
    host.addEventListener('pointerdown', stop, { once: true })
    host.addEventListener('touchstart', stop, { once: true, passive: true })
    host.addEventListener('wheel', stop, { once: true, passive: true })
    return () => {
      host.removeEventListener('pointerdown', stop)
      host.removeEventListener('touchstart', stop)
      host.removeEventListener('wheel', stop)
      stop()
    }
  }, [n])

  // click-and-drag for mouse users, with momentum and a smooth settle
  useEffect(() => {
    const el = track.current
    if (!el) return
    let down = false
    let startX = 0
    let startScroll = 0
    let lastX = 0
    let lastT = 0
    let velocity = 0 // px per ms
    let raf = 0
    let snapTimer = 0

    const settle = () => {
      const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-card]'))
      const mid = el.scrollLeft + el.clientWidth / 2
      let target: HTMLElement | undefined
      let best = Infinity
      for (const c of cards) {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid)
        if (d < best) {
          best = d
          target = c
        }
      }
      if (target) {
        el.scrollTo({ left: target.offsetLeft + target.offsetWidth / 2 - el.clientWidth / 2, behavior: 'smooth' })
      }
      snapTimer = window.setTimeout(() => {
        el.style.scrollSnapType = ''
      }, 450)
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      cancelAnimationFrame(raf)
      window.clearTimeout(snapTimer)
      down = true
      pressing.current = true
      dragged.current = false
      startX = lastX = e.clientX
      lastT = performance.now()
      startScroll = el.scrollLeft
      velocity = 0
    }

    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      if (!dragged.current && Math.abs(dx) > 5) {
        dragged.current = true
        el.style.scrollSnapType = 'none'
        el.style.cursor = 'grabbing'
      }
      if (!dragged.current) return
      el.scrollLeft = startScroll - dx
      const now = performance.now()
      const dt = now - lastT
      if (dt > 0) velocity = (lastX - e.clientX) / dt
      lastX = e.clientX
      lastT = now
    }

    const onUp = () => {
      if (!down) return
      down = false
      pressing.current = false
      el.style.cursor = ''
      if (!dragged.current) return
      const glide = () => {
        el.scrollLeft += velocity * 16
        velocity *= 0.94
        if (Math.abs(velocity) > 0.03) raf = requestAnimationFrame(glide)
        else settle()
      }
      glide()
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(snapTimer)
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

  // reserve the space while trending loads, so the page doesn't jump
  if (n === 0) return <div style={{ height: 300 }} />

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
        className="no-scrollbar relative flex cursor-grab select-none snap-x snap-mandatory gap-4 overflow-x-auto pb-6 pt-2"
        style={{ paddingInline: `calc(50% - ${CARD / 2}px)` }}
      >
        {loop.map((t, i) => (
          <button
            key={`${i}-${t.type}-${t.id}`}
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