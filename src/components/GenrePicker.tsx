import { GENRE_CHOICES } from '../lib/foryou'

// tap to pick or unpick; used by onboarding and Settings
interface Props {
  value: string[]
  onChange: (next: string[]) => void
  offBackground?: string // chip color when not picked, to stand out from what's behind it
}

export default function GenrePicker({ value, onChange, offBackground = '#1f1a24' }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {GENRE_CHOICES.map((g) => {
        const on = value.includes(g.name)
        return (
          <button
            key={g.name}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== g.name) : [...value, g.name])}
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors active:scale-95"
            style={on ? { background: 'var(--accent)', color: '#1a1008' } : { background: offBackground, color: '#cdc6bd' }}
          >
            {g.name}
          </button>
        )
      })}
    </div>
  )
}
