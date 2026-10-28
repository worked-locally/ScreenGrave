import type { ReactNode } from 'react'

export type Tab = 'watchlist' | 'upcoming' | 'discover' | 'watched'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />,
  },
  {
    id: 'upcoming',
    label: 'Upcoming',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    id: 'discover',
    label: 'Discover',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" />
      </>
    ),
  },
  {
    id: 'watched',
    label: 'Watched',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.8 2.8 5.4-5.7" />
      </>
    ),
  },
]

interface Props {
  active: Tab
  onChange: (t: Tab) => void
}

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-white/5 bg-[#0c0a0f]/90 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-xl">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="flex flex-1 flex-col items-center justify-center gap-1 pb-2 pt-3 transition-colors"
            style={{ color: active === t.id ? 'var(--accent)' : '#8b8392' }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              {t.icon}
            </svg>
            <span className="text-[11px] font-medium leading-none tracking-wide">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}