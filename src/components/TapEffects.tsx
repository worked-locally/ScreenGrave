import { useEffect } from 'react'

const SPARKS = 6 // set to 0 for a ripple-only effect
const RARE = 1 / 250 // now and then, a different kind of burst

export default function TapEffects() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const layer = document.createElement('div')
    layer.className = 'tap-layer'
    document.body.appendChild(layer)

    const spawn = (cls: string, x: number, y: number, vars?: Record<string, string>) => {
      const el = document.createElement('span')
      el.className = cls
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      if (vars) Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v))
      layer.appendChild(el)
      el.addEventListener('animationend', () => el.remove())
    }

    const onDown = (e: PointerEvent) => {
      spawn('tap-ripple', e.clientX, e.clientY)
      if (Math.random() < RARE) {
        for (let i = 0; i < 9; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
          const dist = 40 + Math.random() * 40
          spawn('tap-bit', e.clientX, e.clientY, {
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist}px`,
            '--rot': `${Math.round(Math.random() * 360 - 180)}deg`,
            '--s': `${0.8 + Math.random() * 0.5}`,
          })
        }
        return
      }
      for (let i = 0; i < SPARKS; i++) {
        const angle = (Math.PI * 2 * i) / SPARKS + Math.random() * 0.6
        const dist = 24 + Math.random() * 22
        spawn('tap-spark', e.clientX, e.clientY, {
          '--dx': `${Math.cos(angle) * dist}px`,
          '--dy': `${Math.sin(angle) * dist}px`,
        })
      }
    }

    document.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      layer.remove()
    }
  }, [])

  return null
}