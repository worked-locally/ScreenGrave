import { useEffect, useState } from 'react'
import { logout } from '../lib/auth'
import { ago } from '../lib/dates'
import { useTapCount } from '../lib/taps'
import {
  traktConnect,
  traktDevicePoll,
  traktDeviceStart,
  traktDisconnect,
  traktStatus,
  traktSync,
  type DeviceCode,
  type TraktStatus,
} from '../lib/trakt'

type View = 'menu' | 'about' | 'note' | 'busy' | 'connect'

interface Props {
  username: string
  canLogout: boolean
  onOpenSettings: () => void
  connectNow?: boolean // open straight to Trakt sign-in (from onboarding)
}

function Row({
  label,
  hint,
  onClick,
  danger,
}: {
  label: string
  hint?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left transition-colors active:bg-white/5"
    >
      <span className="text-sm" style={{ color: danger ? '#f87171' : '#efe9df' }}>
        {label}
      </span>
      {hint && <span className="mt-0.5 text-[11px] text-[#8b8392]">{hint}</span>}
    </button>
  )
}

export default function UserMenu({ username, canLogout, onOpenSettings, connectNow }: Props) {
  // coming back from Trakt's sign-in page leaves ?trakt=connected (or an error) in the address; read it once
  const [traktReturn] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('trakt')
    if (result) {
      params.delete('trakt')
      const qs = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
    return result
  })
  const failedReturn = !!traktReturn && traktReturn !== 'connected'
  const importing = traktReturn === 'connected'
  const [open, setOpen] = useState(!!connectNow || !!traktReturn)
  const [view, setView] = useState<View>(connectNow ? 'connect' : importing ? 'busy' : failedReturn ? 'note' : 'menu')
  const [note, setNote] = useState(
    importing ? 'Connected to Trakt. Importing your library…' : failedReturn ? "Couldn't connect to Trakt. Please try again." : '',
  )
  const [trakt, setTrakt] = useState<TraktStatus | null>(null)
  const [copied, setCopied] = useState(false)
  const [device, setDevice] = useState<DeviceCode | null>(null)
  const [deviceMsg, setDeviceMsg] = useState(connectNow ? 'Getting a code from Trakt…' : '')
  const [showRedirect, setShowRedirect] = useState(false)
  const tapVersion = useTapCount()

  // asks Trakt for a sign-in code (the "Getting a code…" message is set by whoever calls this)
  function fetchCode() {
    traktDeviceStart()
      .then((d) => {
        setDevice(d)
        setDeviceMsg('')
      })
      .catch((e) => setDeviceMsg(e instanceof Error ? e.message : String(e)))
  }

  function startDevice() {
    setDevice(null)
    setDeviceMsg('Getting a code from Trakt…')
    fetchCode()
  }

  function refreshTrakt() {
    traktStatus()
      .then(setTrakt)
      .catch(() => {})
  }

  function runSync(intro: string) {
    setOpen(true)
    setNote(intro)
    setView('busy')
    void sync()
  }

  // the sync itself; the menu is already showing "busy" when this starts
  async function sync() {
    try {
      const r = await traktSync()
      const changed = r.titles > 0 || r.episodes > 0
      const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
      const parts: string[] = []
      if (changed) parts.push(`added ${plural(r.titles, 'title')} and ${plural(r.episodes, 'episode')} from Trakt`)
      if (r.uploaded) parts.push(`uploaded ${plural(r.uploaded, 'item')} Trakt was missing`)
      if (r.sent && !r.uploaded) parts.push(`sent ${plural(r.sent, 'change')} to Trakt`)
      setNote(
        parts.length
          ? `Synced: ${parts.join(', ')}.${changed ? ' Refreshing…' : ''}`
          : 'Synced with Trakt. Everything was already up to date.',
      )
      setView('note')
      if (changed) window.setTimeout(() => window.location.reload(), 1800)
      else refreshTrakt()
    } catch (e) {
      setNote(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
      setView('note')
      refreshTrakt()
    }
  }

  useEffect(() => {
    refreshTrakt()
  }, [])

  // onboarding's "Import from Trakt instead" opens straight to the code; a successful return from Trakt starts the import
  useEffect(() => {
    if (connectNow) fetchCode()
    if (importing) void sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // while a device code is showing, ask the server every few seconds whether it was approved
  useEffect(() => {
    if (!device) return
    let cancelled = false
    let wait = device.interval * 1000
    let timer = 0
    const tick = async () => {
      const status = await traktDevicePoll()
      if (cancelled) return
      if (status === 'connected') {
        setDevice(null)
        refreshTrakt()
        runSync('Connected to Trakt. Importing your library…')
        return
      }
      if (status === 'denied' || status === 'expired' || status === 'error') {
        setDevice(null)
        setDeviceMsg(
          status === 'denied'
            ? 'Sign-in was declined on Trakt.'
            : status === 'expired'
              ? 'That code expired.'
              : 'Something went wrong talking to Trakt.',
        )
        return
      }
      if (status === 'slow_down') wait += 5000
      timer = window.setTimeout(() => void tick(), wait)
    }
    timer = window.setTimeout(() => void tick(), wait)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view !== 'busy') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, view])

  function go(v: View, text = '') {
    setNote(text)
    setView(v)
  }

  async function signOut() {
    await logout()
    window.location.reload()
  }

  async function disconnect() {
    await traktDisconnect()
    refreshTrakt()
    go('note', 'Disconnected from Trakt. Your library stays as it is.')
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
          if (view !== 'busy') setView('menu')
          setOpen((o) => !o)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-[#1f1a24] py-1.5 pl-3.5 pr-1.5 text-sm font-medium transition-transform active:scale-95"
      >
        <span className="max-w-[7rem] truncate">{username}</span>
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
          <div className="fixed inset-0 z-20" onClick={() => view !== 'busy' && setOpen(false)} />
          <div className="anim-fade absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl bg-[#1f1a24] p-1.5 shadow-xl shadow-black/50">
            {view === 'menu' && (
              <>
                {trakt?.connected ? (
                  <Row
                    label="Sync Now"
                    hint={trakt.lastSync ? `Trakt · last synced ${ago(trakt.lastSync)}` : 'Trakt · not synced yet'}
                    onClick={() => runSync('Syncing with Trakt…')}
                  />
                ) : (
                  <Row
                    label="Connect Trakt"
                    hint={
                      trakt?.configured === false
                        ? 'Not set up on the server'
                        : 'Import your watched history and watchlist'
                    }
                    onClick={() => {
                      if (trakt?.configured === false) {
                        go('note', 'Add TRAKT_CLIENT_ID to the server settings to turn on Trakt sync.')
                      } else {
                        setCopied(false)
                        setShowRedirect(false)
                        go('connect')
                        startDevice()
                      }
                    }}
                  />
                )}
                <Row
                  label="Settings"
                  onClick={() => {
                    setOpen(false)
                    onOpenSettings()
                  }}
                />
                <Row label="About" onClick={() => go('about')} />
                {trakt?.connected && <Row label="Disconnect Trakt" onClick={() => void disconnect()} />}
                {canLogout && (
                  <>
                    <div className="my-1 h-px bg-white/10" />
                    <Row label="Log out" danger onClick={() => void signOut()} />
                  </>
                )}
              </>
            )}

            {view === 'busy' && (
              <div className="flex items-center gap-3 p-3">
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/15"
                  style={{ borderTopColor: 'var(--accent)' }}
                />
                <p className="text-sm text-[#cdc6bd]">{note}</p>
              </div>
            )}

            {view === 'connect' && (
              <div className="p-3">
                <p className="text-sm font-semibold">Connect Trakt</p>

                {!showRedirect && (
                  <>
                    {device ? (
                      <>
                        <p className="mt-1 text-xs leading-relaxed text-[#8b8392]">
                          Go to{' '}
                          <a
                            href={device.verificationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                            style={{ color: 'var(--accent)' }}
                          >
                            {device.verificationUrl.replace(/^https?:\/\//, '')}
                          </a>{' '}
                          on any device and enter this code:
                        </p>
                        <p className="mt-3 select-all text-center font-mono text-2xl font-semibold tracking-[0.2em]">
                          {device.userCode}
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#8b8392]">
                          <span
                            className="h-3 w-3 animate-spin rounded-full border-2 border-white/15"
                            style={{ borderTopColor: 'var(--accent)' }}
                          />
                          Waiting for you to approve…
                        </div>
                      </>
                    ) : (
                      <div className="mt-2">
                        <p className="text-xs leading-relaxed text-[#8b8392]">{deviceMsg}</p>
                        {deviceMsg && !deviceMsg.startsWith('Getting') && (
                          <button
                            onClick={() => startDevice()}
                            className="mt-2 text-xs"
                            style={{ color: 'var(--accent)' }}
                          >
                            Get a new code
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setDevice(null)
                          setView('menu')
                        }}
                        className="text-sm text-[#8b8392]"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          setDevice(null)
                          setShowRedirect(true)
                        }}
                        className="text-[11px] text-[#6b6473] underline"
                      >
                        Use redirect sign-in instead
                      </button>
                    </div>
                  </>
                )}

                {showRedirect && (
                  <>
                    <p className="mt-1 text-xs leading-relaxed text-[#8b8392]">
                      Add this redirect URI in your Trakt app's settings first. Development apps only accept
                      localhost addresses.
                    </p>
                    <input
                      readOnly
                      value={trakt?.redirectUri ?? ''}
                      onFocus={(e) => e.currentTarget.select()}
                      className="mt-2 w-full rounded-lg bg-[#16131a] px-2.5 py-2 font-mono text-[11px] text-[#cdc6bd] outline-none"
                    />
                    {typeof navigator !== 'undefined' && navigator.clipboard && (
                      <button
                        onClick={() => {
                          void navigator.clipboard.writeText(trakt?.redirectUri ?? '').then(() => setCopied(true))
                        }}
                        className="mt-1.5 text-xs"
                        style={{ color: 'var(--accent)' }}
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setShowRedirect(false)
                          startDevice()
                        }}
                        className="text-sm text-[#8b8392]"
                      >
                        Back
                      </button>
                      <button
                        onClick={traktConnect}
                        className="rounded-full px-4 py-1.5 text-sm font-semibold"
                        style={{ background: 'var(--accent)', color: '#1a1008' }}
                      >
                        Continue to Trakt
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {view === 'about' && (
              <div className="p-3">
                <p className="text-sm font-semibold">
                  ScreenGrave{' '}
                  <span onClick={tapVersion} className="select-none text-xs font-normal text-[#8b8392]">
                    v{__APP_VERSION__}
                  </span>
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