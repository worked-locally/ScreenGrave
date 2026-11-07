import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import Celebrations from './components/Celebrate'
import RollHost from './components/RollHost'
import TabBar, { type Tab } from './components/TabBar'
import TapEffects from './components/TapEffects'
import UserMenu from './components/UserMenu'
import { getSession, type Session } from './lib/auth'
import { useEpisodes } from './lib/episodes'
import { keyOf, useLibrary } from './lib/library'
import { getPrefs, savePrefs, type Prefs } from './lib/settings'
import { useShowInfo } from './lib/showinfo'
import { StatusContext } from './lib/status'
import { traktStatus } from './lib/trakt'
import { seasonEpisodes, setRegion, showSeasons, type Title } from './lib/tmdb'
import type { OnboardingResult } from './screens/Onboarding'
import Watchlist from './screens/Watchlist'

// The Watchlist (the first screen) comes with the app. Everything else is a separate file that
// downloads in the background right after, so the first screen shows up sooner and later taps stay instant.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function later<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return Object.assign(lazy(load), { preload: load })
}
const Discover = later(() => import('./screens/Discover'))
const Upcoming = later(() => import('./screens/Upcoming'))
const Watched = later(() => import('./screens/Watched'))
const DetailSheet = later(() => import('./components/DetailSheet'))
const SettingsSheet = later(() => import('./components/SettingsSheet'))
const Login = later(() => import('./screens/Login'))
const Setup = later(() => import('./screens/Setup'))
const Onboarding = later(() => import('./screens/Onboarding'))

function whenIdle(fn: () => void) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(fn)
  else window.setTimeout(fn, 800)
}

// remembers which shows the app moved on its own, so it can tell those apart from your own changes
const AUTO_MOVES = 'screengrave:auto-moves'
type MoveRecord = { to: 'watched' | 'watchlist'; aired: number; at: number }

function Splash({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="anim-fade text-sm tracking-wide text-[#8b8392]">{text}</p>
    </div>
  )
}

function ServerDown() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="text-lg font-semibold">Can't reach the ScreenGrave server</p>
      <p className="text-sm text-[#8b8392]">Make sure the server is running, then try again.</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-full px-5 py-2 text-sm font-semibold"
        style={{ background: 'var(--accent)', color: '#1a1008' }}
      >
        Try again
      </button>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [down, setDown] = useState(false)

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch(() => setDown(true))
  }, [])

  if (down) return <ServerDown />
  if (!session) return <Splash text="Loading…" />
  if (session.setupRequired) {
    return (
      <Suspense fallback={<Splash text="Loading…" />}>
      <Setup
        onDone={() =>
          getSession()
            .then(setSession)
            .catch(() => setDown(true))
        }
      />
      </Suspense>
    )
  }
  if (session.authRequired && !session.authenticated) {
    return (
      <Suspense fallback={<Splash text="Loading…" />}>
      <Login
        username={session.username}
        method={session.method}
        onSuccess={() => setSession({ ...session, authenticated: true })}
      />
      </Suspense>
    )
  }
  return <Shell session={session} />
}

function Shell({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('watchlist')
  const [selected, setSelected] = useState<Title | null>(null)
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [traktReady, setTraktReady] = useState(false) // Trakt is set up on the server
  const [connectTrakt, setConnectTrakt] = useState(false) // open the Trakt sign-in once onboarding hands off
  const { library, ready, error, setList, remove } = useLibrary()

  useEffect(() => {
    traktStatus()
      .then((s) => setTraktReady(s.configured && !s.connected))
      .catch(() => {})
  }, [])

  // your Settings (region, display name, two-way sync) are loaded before the screens
  useEffect(() => {
    getPrefs()
      .then((p) => {
        setRegion(p.region)
        setPrefs(p)
      })
      .catch(() => setPrefs({ displayName: '', region: 'US', twoWaySync: true, genres: [], onboarded: true }))
  }, [])
  // once you're in, fetch the other screens quietly in the background
  useEffect(() => {
    whenIdle(() => [Discover, Upcoming, Watched, DetailSheet, SettingsSheet].forEach((c) => void c.preload()))
  }, [])
  const username = prefs?.displayName || session.username
  const ep = useEpisodes()

  // everything on the Watchlist, plus Watched shows (they may still get new episodes)
  const trackedTitles = Object.values(library)
    .filter((e) => e.list === 'watchlist' || (e.list === 'watched' && e.title.type === 'tv'))
    .map((e) => e.title)
  const info = useShowInfo(trackedTitles)

  // keeps the Watchlist to shows you still need to catch up on:
  // caught up moves to Watched, and new episodes move a running show back
  const count = ep.count
  useEffect(() => {
    if (!ready) return
    let records: Record<string, MoveRecord>
    try {
      records = JSON.parse(localStorage.getItem(AUTO_MOVES) ?? '{}')
    } catch {
      records = {}
    }
    let changed = false

    for (const e of Object.values(library)) {
      const t = e.title
      if (t.type !== 'tv') continue
      const key = keyOf(t)
      const i = info[key]
      if (!i || i.aired === 0) continue
      const seen = count(key)
      const rec = records[key]

      if (e.list === 'watchlist' && seen >= i.aired) {
        // you put it back yourself (a rewatch) and nothing new has aired since, so leave it
        if (rec?.to === 'watched' && rec.aired === i.aired && (e.addedAt ?? 0) > rec.at) continue
        setList(t, 'watched', true)
        records[key] = { to: 'watched', aired: i.aired, at: Date.now() }
        changed = true
      } else if (e.list === 'watched' && !i.ended && seen > 0 && seen < i.aired) {
        // new episodes came out for a show you were caught up on
        setList(t, 'watchlist', true)
        records[key] = { to: 'watchlist', aired: i.aired, at: Date.now() }
        changed = true
      }
    }

    if (changed) {
      try {
        localStorage.setItem(AUTO_MOVES, JSON.stringify(records))
      } catch {
        // storage unavailable; worst case a show is checked again next time
      }
    }
  }, [ready, library, info, count, setList])

  // marks every aired episode of every season as watched
  async function markShowWatched(t: Title) {
    if (t.type !== 'tv') return
    try {
      const today = new Date().toLocaleDateString('en-CA')
      const seasons = await showSeasons(t.id)
      const lists = await Promise.all(
        seasons.map((s) => seasonEpisodes(t.id, s.number).then((eps) => ({ season: s.number, eps }))),
      )
      const keys = lists.flatMap(({ season, eps }) =>
        eps.filter((e) => !e.airDate || e.airDate <= today).map((e) => `${season}-${e.number}`),
      )
      ep.addBulk({ [keyOf(t)]: keys })
    } catch {
      // the show is still moved to Watched even if the episode lookup fails
    }
  }

  // checks off every aired episode in the seasons before the one you're on
  async function markSeasonsBefore(t: Title, season: number) {
    if (season <= 1) return
    try {
      const today = new Date().toLocaleDateString('en-CA')
      const lists = await Promise.all(
        Array.from({ length: season - 1 }, (_, i) => i + 1).map((n) =>
          seasonEpisodes(t.id, n)
            .then((eps) => ({ season: n, eps }))
            .catch(() => ({ season: n, eps: [] })),
        ),
      )
      const keys = lists.flatMap(({ season: n, eps }) =>
        eps.filter((e) => !e.airDate || e.airDate <= today).map((e) => `${n}-${e.number}`),
      )
      if (keys.length) ep.addBulk({ [keyOf(t)]: keys })
    } catch {
      // the show is still on the Watchlist; episodes can be checked off by hand
    }
  }

  async function finishOnboarding(r: OnboardingResult) {
    const next = await savePrefs({ genres: r.genres, onboarded: true }).catch(() => null)
    setPrefs((p) => next ?? (p ? { ...p, genres: r.genres, onboarded: true } : p))
    // the episode lookups run in the background while you look around
    for (const t of r.watched) {
      setList(t, 'watched')
      if (t.type === 'tv') void markShowWatched(t)
    }
    for (const { title, season } of r.watching) {
      setList(title, 'watchlist')
      void markSeasonsBefore(title, season)
    }
  }

  async function onboardingToTrakt(genres: string[]) {
    const next = await savePrefs({ genres, onboarded: true }).catch(() => null)
    setPrefs((p) => next ?? (p ? { ...p, genres, onboarded: true } : p))
    setConnectTrakt(true)
  }

  if (error) return <ServerDown />
  if (!ready || !prefs) return <Splash text="Loading your library…" />

  if (!prefs.onboarded) {
    return (
      <Suspense fallback={<Splash text="Loading…" />}>
      <Onboarding
        username={username}
        existing={Object.keys(library).length > 0}
        traktConfigured={traktReady}
        onFinish={(r) => void finishOnboarding(r)}
        onTrakt={(g) => void onboardingToTrakt(g)}
      />
      </Suspense>
    )
  }

  return (
    <StatusContext.Provider value={{ library, info, count: ep.count }}>
      <div
        className="relative mx-auto min-h-full max-w-xl px-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 2rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 6.5rem)',
        }}
      >
        <div className="status-cover" aria-hidden="true" />
        <TapEffects />
        <Celebrations />
        <RollHost />
        <UserMenu
          username={username}
          canLogout={session.authRequired}
          onOpenSettings={() => setSettingsOpen(true)}
          connectNow={connectTrakt}
        />

        <div key={tab} className="anim-fade">
          <Suspense fallback={null}>
          {tab === 'watchlist' && <Watchlist library={library} info={info} ep={ep} onSelect={setSelected} />}
          {tab === 'upcoming' && <Upcoming library={library} info={info} onSelect={setSelected} />}
          {tab === 'discover' && (
            <Discover
              library={library}
              favoriteGenres={prefs.genres}
              onSelect={setSelected}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
          {tab === 'watched' && <Watched library={library} onSelect={setSelected} />}
          </Suspense>
        </div>

        <TabBar active={tab} onChange={setTab} />

        <Suspense fallback={null}>
        {selected && (
          <DetailSheet
            title={selected}
            current={library[keyOf(selected)]?.list}
            onClose={() => setSelected(null)}
            onSet={(list) => {
              setList(selected, list)
              if (list === 'watched') void markShowWatched(selected)
            }}
            onRemove={() => remove(selected)}
            ep={ep}
          />
        )}

        {settingsOpen && (
          <SettingsSheet
            prefs={prefs}
            username={session.username}
            passwordSource={session.passwordSource}
            method={session.method}
            onChange={setPrefs}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        </Suspense>
      </div>
    </StatusContext.Provider>
  )
}