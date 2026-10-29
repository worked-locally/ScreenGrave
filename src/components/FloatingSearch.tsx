import { useEffect, useState, type RefObject } from 'react'

interface Props {
  target: RefObject<HTMLInputElement | null>
  onUp?: () => void // when given, a scroll-up button appears at the bottom of the page
}

export default function FloatingSearch({ target, onUp }: Props) {
  const [searchVisible, setSearchVisible] = useState(true)
  const [atBottom, setAtBottom] = useState(false)

  // hide the floating button while the real search bar is on screen
  useEffect(() => {
    const el = target.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setSearchVisible(entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [target])

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

  const showUp = !!onUp && atBottom
  const showSearch = !searchVisible
  if (!showUp && !showSearch) return null

  function focusSearch() {
    target.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[12]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
    >
      <div className="mx-auto flex max-w-xl justify-end gap-3 px-4">
        {showUp && (
          <button
            onClick={onUp}
            aria-label="Scroll up"
            className="anim-fade pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#1f1a24]/95 text-[#efe9df] shadow-lg shadow-black/50 backdrop-blur transition-transform active:scale-90"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
        {showSearch && (
          <button
            onClick={focusSearch}
            aria-label="Search"
            className="anim-fade pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full shadow-lg shadow-black/50 transition-transform active:scale-90"
            style={{ background: 'var(--accent)', color: '#1a1008' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}