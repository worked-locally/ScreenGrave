export type Tab = 'watchlist' | 'upcoming' | 'discover' | 'watched'

const TABS: { id: Tab; label: string }[] = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'discover', label: 'Discover' },
  { id: 'watched', label: 'Watched' },
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
            className="flex-1 py-5 text-[15px] font-semibold tracking-wide transition-colors"
            style={{ color: active === t.id ? 'var(--accent)' : '#8b8392' }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}