import { TabIcon } from './TabIcons'

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
  const index = TABS.findIndex((t) => t.id === active)
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-white/5 bg-[#0c0a0f]/90 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative mx-auto flex max-w-xl">
        {/* a soft amber glow under the tab you're on; it glides along when you switch */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${index * 100}%)` }}
        >
          <span
            className="absolute inset-x-[2%] bottom-0 top-0"
            style={{
              background:
                'radial-gradient(60% 100% at 50% 100%, rgba(255,159,69,0.3), rgba(255,140,50,0.1) 50%, transparent 80%)',
            }}
          />
          <span
            className="absolute inset-x-[12%] bottom-0 h-0.5 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #ff9f45 22%, #ffb56e 50%, #ff9f45 78%, transparent)',
              boxShadow: '0 0 10px 1px rgba(255,159,69,0.55)',
            }}
          />
        </span>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 pb-2 pt-3 transition-colors"
            style={{
              color: active === t.id ? 'var(--accent)' : '#8b8392',
              filter: active === t.id ? 'drop-shadow(0 0 5px rgba(255,159,69,0.35))' : undefined,
            }}
          >
            <TabIcon tab={t.id} />
            <span className="text-[11px] font-medium leading-none tracking-wide">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}