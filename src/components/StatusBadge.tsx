import type { ReactNode } from 'react'
import type { Status } from '../lib/status'

const BOOKMARK = 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z'

const ICONS: Record<Status, ReactNode> = {
  watched: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  watching: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  upcoming: (
    <>
      <path d={BOOKMARK} />
      <circle cx="12" cy="9.5" r="3" />
      <path d="M12 8v1.7l1.1.7" />
    </>
  ),
  ready: (
    <>
      <path d={BOOKMARK} />
      <path d="M10.3 6.5v5l4-2.5z" fill="currentColor" />
    </>
  ),
}

const META: Record<Status, { label: string; color: string }> = {
  watched: { label: 'Watched', color: 'var(--done)' },
  watching: { label: 'Watching', color: 'var(--accent)' },
  upcoming: { label: 'Not out yet', color: '#cdc6bd' },
  ready: { label: 'Out now, not started', color: 'var(--accent)' },
}

export default function StatusBadge({ status }: { status: Status | null }) {
  if (!status) return null
  const { label, color } = META[status]
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm"
      style={{ color }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        {ICONS[status]}
      </svg>
    </span>
  )
}