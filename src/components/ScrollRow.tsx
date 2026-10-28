import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  bleed?: boolean // extend into the page's side padding
  centerActive?: string | number // re-centers the child marked data-active="true" when this changes
}

const ARROW =
  'absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-[#efe9df] shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 [@media(pointer:fine)]:flex'

export default function ScrollRow({ children, className = '', bleed = false, centerActive }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [can, setCan] = useState({ left: false, right: false })

  const check = useCallback(() => {
    const el = ref.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setCan((c) => (c.left === left && c.right === right ? c : { left, right }))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    check()
    el.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    const mo = new MutationObserver(check)
    mo.observe(el, { childList: true })
    return () => {
      el.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      ro.disconnect()
      mo.disconnect()
    }
  }, [check])

  useEffect(() => {
    const el = ref.current
    const active = el?.querySelector<HTMLElement>('[data-active="true"]')
    if (el && active) el.scrollLeft = active.offsetLeft - el.clientWidth / 2 + active.offsetWidth / 2
  }, [centerActive])

  function by(dir: 1 | -1) {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className={`relative ${bleed ? '-mx-4' : ''}`}>
      {can.left && (
        <button onClick={() => by(-1)} aria-label="Scroll left" className={`${ARROW} left-2`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      {can.right && (
        <button onClick={() => by(1)} aria-label="Scroll right" className={`${ARROW} right-2`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      <div ref={ref} className={`no-scrollbar relative flex overflow-x-auto ${className}`}>
        {children}
      </div>
    </div>
  )
}