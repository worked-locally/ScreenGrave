import type { Method } from '../lib/auth'

// The three ways to sign in, shared by first-run setup and Settings.

const OPTIONS: { id: Method; label: string; hint: string; badge?: string }[] = [
  { id: 'pin', label: 'PIN', hint: 'A few numbers, quick to type. Great for a home network.', badge: 'Recommended' },
  { id: 'password', label: 'Password', hint: 'Best if this server can be reached from the internet.' },
  { id: 'none', label: 'No sign-in', hint: 'Anyone who can reach this server can see and change your library.' },
]

export function MethodPicker({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  return (
    <div role="radiogroup" aria-label="How to sign in" className="space-y-2">
      {OPTIONS.map((o) => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors"
            style={{
              background: '#1f1a24',
              boxShadow: active ? '0 0 0 2px var(--accent)' : '0 0 0 2px transparent',
            }}
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
              style={{ borderColor: active ? 'var(--accent)' : '#3a3340' }}
            >
              {active && <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} />}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-medium">
                {o.label}
                {o.badge && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--accent)', color: '#1a1008' }}>
                    {o.badge}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: o.id === 'none' && active ? '#f87171' : '#8b8392' }}>
                {o.hint}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface SecretProps {
  method: Method
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  autoFocus?: boolean
  className: string
}

// a numeric keypad for PINs, a normal field for passwords
export function SecretInput({ method, value, onChange, placeholder, autoComplete, autoFocus, className }: SecretProps) {
  const pin = method === 'pin'
  return (
    <input
      type="password"
      inputMode={pin ? 'numeric' : undefined}
      pattern={pin ? '[0-9]*' : undefined}
      maxLength={pin ? 8 : 128}
      value={value}
      onChange={(e) => onChange(pin ? e.target.value.replace(/\D/g, '') : e.target.value)}
      placeholder={placeholder ?? (pin ? 'PIN (4 to 8 numbers)' : 'Password (8+ characters)')}
      autoComplete={autoComplete ?? 'new-password'}
      autoFocus={autoFocus}
      className={className + (pin ? ' tracking-[0.3em]' : '')}
    />
  )
}
