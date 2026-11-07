// the on/off toggle used in Settings
export default function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
      style={{ background: on ? 'var(--accent)' : '#3a3340' }}
    >
      <span
        className="absolute top-1 h-5 w-5 rounded-full bg-[#efe9df] transition-transform"
        style={{ left: 4, transform: on ? 'translateX(20px)' : 'none' }}
      />
    </button>
  )
}
