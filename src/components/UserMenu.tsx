import { useEffect, useState } from 'react'
import { logout } from '../lib/auth'
import { traktConnect, traktDisconnect, traktStatus, traktSync, type TraktStatus } from '../lib/trakt'

type View = 'menu' | 'about' | 'note' | 'busy'

interface Props {
  username: string
  canLogout: boolean
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

function ago(ms: number) {
  const min = Math.round((Date.now() - ms) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export default function UserMenu({ username, canLogout }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [note, setNote] = useState('')
  const [trakt, setTrakt] = useState<TraktStatus | null>(null)

  function refreshTrakt() {
    traktStatus()
      .then(setTrakt)
      .catch(() => {})
  }

  async function runSync(intro: string) {
    setOpen(true)
    setNote(intro)
    setView('busy')
    try {
      const r = await traktSync()
      const changed = r.titles > 0 || r.episodes > 0
      setNote(
        changed
          ? `Synced with Trakt: added ${r.titles} titles and ${r.episodes} episodes. Refreshing…`
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

  // coming back from Trakt's sign-in page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('trakt')
    if (!result) return
    params.delete('trakt')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    if (result === 'connected') {
      void runSync('Connected to Trakt. Importing your library…')
    } else {
      setOpen(true)
      setNote("Couldn't connect to Trakt. Please try again.")
      setView('note')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                    onClick={() => void runSync('Syncing with Trakt…')}
                  />
                ) : (
                  <Row
                    label="Connect Trakt"
                    hint={
                      trakt?.configured === false
                        ? 'Not set up on the server'
                        : 'Import your watched history and watchlist'
                    }
                    onClick={() =>
                      trakt?.configured === false
                        ? go('note', 'Add TRAKT_CLIENT_ID to the server settings to turn on Trakt sync.')
                        : traktConnect()
                    }
                  />
                )}
                <Row label="Settings" onClick={() => go('note', 'Settings are coming soon.')} />
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

            {view === 'about' && (
              <div className="p-3">
                <p className="text-sm font-semibold">
                  ScreenGrave <span className="text-xs font-normal text-[#8b8392]">v0.4.5</span>
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