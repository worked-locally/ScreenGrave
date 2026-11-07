import { useEffect, useState } from 'react'
import { CELEBRATE_EVENT as EVENT } from '../lib/celebrate'

// A small party when you finish a season or catch up on a show:
// a burst of amber and teal from where you tapped, and a short message at the top.

interface Burst {
  id: number
  text: string
}

const PIECES = 28

function burst(x: number, y: number) {
  const layer = document.createElement('div')
  layer.className = 'tap-layer'
  document.body.appendChild(layer)
  for (let i = 0; i < PIECES; i++) {
    const el = document.createElement('span')
    const angle = (Math.PI * 2 * i) / PIECES + Math.random() * 0.4
    const dist = 60 + Math.random() * 70
    el.className = i % 3 === 0 ? 'party-bit party-strip' : 'party-bit'
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.background = i % 2 ? 'var(--accent)' : 'var(--done)'
    el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    el.style.setProperty('--dy', `${Math.sin(angle) * dist - 30}px`)
    el.style.setProperty('--spin', `${Math.round(Math.random() * 540 - 270)}deg`)
    el.style.animationDelay = `${Math.random() * 60}ms`
    layer.appendChild(el)
  }
  window.setTimeout(() => layer.remove(), 1300)
}

export default function Celebrations() {
  const [toast, setToast] = useState<Burst | null>(null)

  useEffect(() => {
    let timer = 0
    const onEvent = (e: Event) => {
      const { text, from } = (e as CustomEvent<{ text: string; from?: { x: number; y: number } }>).detail
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!calm) burst(from?.x ?? window.innerWidth / 2, from?.y ?? window.innerHeight / 2)
      setToast({ id: Date.now(), text })
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setToast(null), 2600)
    }
    window.addEventListener(EVENT, onEvent)
    return () => {
      window.removeEventListener(EVENT, onEvent)
      window.clearTimeout(timer)
    }
  }, [])

  if (!toast) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      role="status"
    >
      <p
        key={toast.id}
        className="anim-pop flex items-center gap-2 rounded-full border border-[#3fb9a8]/40 bg-[#16131a]/95 px-4 py-2 text-sm font-medium shadow-lg shadow-black/50 backdrop-blur"
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
          style={{ background: 'var(--done)', color: '#1a1008' }}
        >
          ✓
        </span>
        {toast.text}
      </p>
    </div>
  )
}
