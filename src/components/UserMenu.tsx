import { useEffect, useState } from 'react'

const KEY = 'screengrave:user'

type View = 'menu' | 'auth' | 'about' | 'note'

function Row({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors active:bg-white/5"
      style={{ color: danger ? '#f87171' : '#efe9df' }}
    >
      {label}
    </button>
  )
}

export default function UserMenu() {
  const [name, setName] = useState<string | null>(() => localStorage.getItem(KEY))
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function go(v: View, text = '') {
    setNote(text)
    setView(v)
  }

  function signIn() {
    const v = draft.trim()
    if (!v) return
    localStorage.setItem(KEY, v)
    setName(v)
    setDraft('')
    setOpen(false)
  }

  function signOut() {
    localStorage.removeItem(KEY)
    setName(null)
    setOpen(false)
  }

  const back = (
    <button onClick={() => setView('menu')} className="text-sm text-[#8b8392]">
      Back
    </button>
  )

  return (
    <div className="absolute right-4 z-[15]" style={{ top: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
            <button
        onClick={() => {
          setView('menu')
          setOpen((o) => !o)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-[#1f1a24] py-1.5 pl-3.5 pr-1.5 text-sm font-medium transition-transform active:scale-95"
      >
        <span className="max-w-[7rem] truncate">{name ?? 'Guest'}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2b2530] text-[#cdc6bd]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
          </svg>
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="anim-fade absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl bg-[#1f1a24] p-1.5 shadow-xl shadow-black/50">
            {view === 'menu' &&
              (name ? (
                <>
                  <Row label="Sync Now" onClick={() => go('note', "Sync with Trakt isn't connected yet. It's coming soon.")} />
                  <Row label="Settings" onClick={() => go('note', 'Settings are coming soon.')} />
                  <Row label="About" onClick={() => go('about')} />
                  <div className="my-1 h-px bg-white/10" />
                  <Row label="Log out" danger onClick={signOut} />
                </>
              ) : (
                <>
                  <Row
                    label="Login"
                    onClick={() => {
                      setMode('login')
                      go('auth')
                    }}
                  />
                  <Row
                    label="Register"
                    onClick={() => {
                      setMode('register')
                      go('auth')
                    }}
                  />
                  <Row label="About" onClick={() => go('about')} />
                </>
              ))}

            {view === 'auth' && (
              <div className="p-3">
                <p className="text-sm font-semibold">{mode === 'login' ? 'Login' : 'Register'}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#8b8392]">
                  Temporary sign-in: pick a display name. Trakt and Google sign-in are coming later.
                </p>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') signIn()
                  }}
                  placeholder="Display name"
                  maxLength={20}
                  autoComplete="off"
                  className="mt-3 w-full rounded-xl bg-[#16131a] px-3 py-2.5 text-sm outline-none placeholder:text-[#8b8392]"
                />
                <div className="mt-3 flex items-center justify-between">
                  {back}
                  <button
                    onClick={signIn}
                    className="rounded-full px-4 py-1.5 text-sm font-semibold"
                    style={{ background: 'var(--accent)', color: '#1a1008' }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {view === 'about' && (
              <div className="p-3">
                <p className="text-sm font-semibold">
                  ScreenGrave <span className="text-xs font-normal text-[#8b8392]">v0.1</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#8b8392]">
                  A clean tracker for the shows and movies you love.
                </p>
                <p className="mt-3 text-[11px] leading-relaxed text-[#8b8392]">
                  This product uses the TMDB API but is not endorsed or certified by TMDB.
                </p>
                <div className="mt-3">{back}</div>
              </div>
            )}

            {view === 'note' && (
              <div className="p-3">
                <p className="text-sm text-[#cdc6bd]">{note}</p>
                <div className="mt-3">{back}</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}