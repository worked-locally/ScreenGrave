import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { changeMethod, type Method, type Session } from '../lib/auth'
import GenrePicker from './GenrePicker'
import NotifySettings from './NotifySettings'
import { MethodPicker, SecretInput, secretProblem } from './SignInChoice'
import { REGIONS, savePrefs, type Prefs } from '../lib/settings'
import { traktDisconnect, traktStatus, type TraktStatus } from '../lib/trakt'

interface Props {
  prefs: Prefs
  username: string
  passwordSource: Session['passwordSource']
  method: Method
  onChange: (next: Prefs) => void
  onClose: () => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 px-1 text-sm font-semibold text-[#8b8392]">{title}</h3>
      <div className="divide-y divide-white/5 rounded-2xl bg-[#1f1a24]">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-[#8b8392]">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
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

const ago = (ms: number) => {
  const min = Math.round((Date.now() - ms) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

const METHOD_NAME: Record<Method, string> = { pin: 'PIN', password: 'Password', none: 'No sign-in' }

function SignInForm({ method: currentMethod, onSaved }: { method: Method; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<Method>(currentMethod)
  const [current, setCurrent] = useState('')
  const [secret, setSecret] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (method !== 'none') {
      const problem = secretProblem(method, secret)
      if (problem) return setMessage(problem)
      if (secret !== confirm) return setMessage("The new entries don't match.")
    }
    setBusy(true)
    const error = await changeMethod(current, method, method === 'none' ? '' : secret)
    setBusy(false)
    if (error) return setMessage(error)
    onSaved()
  }

  if (!open) {
    return (
      <Row label="Sign-in" hint={METHOD_NAME[currentMethod]}>
        <button onClick={() => setOpen(true)} className="text-sm" style={{ color: 'var(--accent)' }}>
          Change
        </button>
      </Row>
    )
  }

  const field = 'w-full rounded-xl bg-[#16131a] px-3 py-2.5 text-base outline-none placeholder:text-[#8b8392]'
  return (
    <form onSubmit={submit} className="space-y-3 px-4 py-3.5">
      {currentMethod !== 'none' && (
        <SecretInput
          method={currentMethod}
          value={current}
          onChange={setCurrent}
          placeholder={`Current ${currentMethod === 'pin' ? 'PIN' : 'password'}`}
          autoComplete="current-password"
          className={field}
        />
      )}
      <MethodPicker
        value={method}
        onChange={(m) => {
          setMethod(m)
          setSecret('')
          setConfirm('')
          setMessage('')
        }}
      />
      {method !== 'none' && (
        <>
          <SecretInput method={method} value={secret} onChange={setSecret} className={field} />
          <SecretInput method={method} value={confirm} onChange={setConfirm} placeholder="Type it again" className={field} />
        </>
      )}
      {message && <p className="text-xs text-red-400">{message}</p>}
      <p className="text-xs text-[#8b8392]">Other devices will be signed out. This one stays signed in.</p>
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-[#8b8392]">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || (currentMethod !== 'none' && !current) || (method !== 'none' && (!secret || !confirm))}
          className="rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#1a1008' }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export default function SettingsSheet({ prefs, username, passwordSource, method, onChange, onClose }: Props) {
  const [name, setName] = useState(prefs.displayName || username)
  const [trakt, setTrakt] = useState<TraktStatus | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [genres, setGenres] = useState(prefs.genres)

  useEffect(() => {
    traktStatus()
      .then(setTrakt)
      .catch(() => {})
  }, [])

  // keep the page behind still while Settings is open
  useEffect(() => {
    const y = window.scrollY
    const body = document.body
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width }
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      window.scrollTo(0, y)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save(change: Partial<Prefs>, message = 'Saved') {
    setError('')
    try {
      const next = await savePrefs(change)
      onChange(next)
      setSaved(message)
      window.setTimeout(() => setSaved(''), 1800)
      return next
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  async function saveName() {
    const v = name.trim()
    if (v === (prefs.displayName || username)) return
    await save({ displayName: v }, 'Name saved')
  }

  async function changeRegion(code: string) {
    const next = await save({ region: code })
    if (!next) return
    // dates and services are cached per region, so start fresh
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('screengrave:info')) localStorage.removeItem(k)
    } catch {
      // storage unavailable
    }
    window.location.reload()
  }

  async function disconnect() {
    await traktDisconnect()
    setTrakt(await traktStatus().catch(() => null))
  }

  const traktLine = !trakt
    ? 'Checking…'
    : !trakt.configured
      ? 'Not set up on the server (add TRAKT_CLIENT_ID)'
      : !trakt.connected
        ? 'Not connected. Use Connect Trakt in the menu.'
        : trakt.lastSync
          ? `Connected · last synced ${ago(trakt.lastSync)}`
          : 'Connected · not synced yet'

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <div className="anim-fade touch-none absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Settings"
        className="anim-sheet relative h-[92%] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-[#16131a] px-5 pt-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 transition-transform active:scale-90"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="mt-1 h-4 text-xs" style={{ color: error ? '#f87171' : 'var(--done)' }}>
          {error || saved}
        </p>

        <Section title="Account">
          <div className="px-4 py-3.5">
            <label htmlFor="display-name" className="text-sm">
              Display name
            </label>
            <input
              id="display-name"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void saveName()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              autoComplete="off"
              className="mt-2 w-full rounded-xl bg-[#16131a] px-3 py-2.5 text-base outline-none"
            />
          </div>
          {passwordSource === 'app' && (
            <SignInForm
              method={method}
              onSaved={() => {
                setSaved('Sign-in updated')
                window.setTimeout(() => window.location.reload(), 900)
              }}
            />
          )}
          {passwordSource === 'env' && (
            <Row label="Sign-in" hint="Password set by APP_PASSWORD in the server's settings file. Remove it there to choose a PIN or password here." />
          )}
          {passwordSource === 'off' && <Row label="Sign-in" hint="Turned off on this server (AUTH_DISABLED)." />}
        </Section>

        <Section title="Trakt">
          <Row label="Status" hint={traktLine} />
          <Row
            label="Two-way sync"
            hint={
              prefs.twoWaySync
                ? 'Your watchlist and watch history changes are sent to Trakt, including removals.'
                : 'Off: Trakt only sends to ScreenGrave. Your changes stay here.'
            }
          >
            <Switch
              on={prefs.twoWaySync}
              label="Two-way sync"
              onToggle={() =>
                void save(
                  { twoWaySync: !prefs.twoWaySync },
                  prefs.twoWaySync ? 'Two-way sync off' : 'Two-way sync on: changes will be sent on the next sync',
                )
              }
            />
          </Row>
          {!!trakt?.pending && (
            <Row label="Waiting to send" hint={`${trakt.pending} change${trakt.pending === 1 ? '' : 's'} will go to Trakt shortly.`} />
          )}
          {trakt?.connected && (
            <div className="px-4 py-3">
              <button onClick={() => void disconnect()} className="text-sm text-[#f87171]">
                Disconnect Trakt
              </button>
            </div>
          )}
        </Section>

        <Section title="For You">
          <div className="px-4 py-3.5">
            <p className="text-sm">Favorite genres</p>
            <p className="mb-3 mt-0.5 text-xs leading-relaxed text-[#8b8392]">
              Discover shows top picks for three of these at a time (a different mix each visit), along with picks based on what you've watched.
            </p>
            <GenrePicker
              value={genres}
              offBackground="#16131a"
              onChange={(g) => {
                setGenres(g)
                void save({ genres: g }, 'Genres saved')
              }}
            />
          </div>
        </Section>

        <Section title="Notifications">
          <NotifySettings />
        </Section>

        <Section title="Region">
          <Row label="Country" hint="Used for release dates and the streaming services on Discover.">
            <select
              value={prefs.region}
              onChange={(e) => void changeRegion(e.target.value)}
              className="max-w-[10rem] rounded-xl bg-[#16131a] px-3 py-2 text-sm outline-none"
            >
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="About">
          <Row label="ScreenGrave" hint={`Version ${__APP_VERSION__}`} />
          <div className="px-4 py-3.5 text-xs leading-relaxed text-[#8b8392]">
            Data and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
          </div>
        </Section>
      </div>
    </div>
  )
}
