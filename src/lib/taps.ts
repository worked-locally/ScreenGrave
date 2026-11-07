import { useRef } from 'react'

const EVENT = 'screengrave:roll'

export const startRoll = () => window.dispatchEvent(new Event(EVENT))
export const onRoll = (fn: () => void) => {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

// counts quick taps on one element; seven in a row (each within 1.5s of the last) starts the long view
export function useTapCount(times = 7) {
  const count = useRef(0)
  const last = useRef(0)
  return () => {
    const now = Date.now()
    count.current = now - last.current < 1500 ? count.current + 1 : 1
    last.current = now
    if (count.current >= times) {
      count.current = 0
      startRoll()
    }
  }
}
