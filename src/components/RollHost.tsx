import { lazy, Suspense, useEffect, useState } from 'react'
import { onRoll } from '../lib/taps'

const Roll = lazy(() => import('./Roll'))

export default function RollHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => onRoll(() => setOpen(true)), [])
  if (!open) return null
  return (
    <Suspense fallback={null}>
      <Roll onClose={() => setOpen(false)} />
    </Suspense>
  )
}
