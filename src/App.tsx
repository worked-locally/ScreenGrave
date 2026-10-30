import { useEffect, useState } from 'react'
import DetailSheet from './components/DetailSheet'
import TabBar, { type Tab } from './components/TabBar'
import TapEffects from './components/TapEffects'
import UserMenu from './components/UserMenu'
import { getSession, type Session } from './lib/auth'
import { useEpisodes } from './lib/episodes'
import { keyOf, useLibrary } from './lib/library'
import { useShowInfo } from './lib/showinfo'
import { StatusContext } from './lib/status'
import { seasonEpisodes, showSeasons, type Title } from './lib/tmdb'
import Discover from './screens/Discover'
import Login from './screens/Login'
import Upcoming from './screens/Upcoming'
import Watched from './screens/Watched'
import Watchlist from './screens/Watchlist'

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
  if (session.authRequired && !session.authenticated) {
    return <Login username={session.username} onSuccess={() => setSession({ ...session, authenticated: true })} />
  }
  return <Shell session={session} />
}

function Shell({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('watchlist')
  const [selected, setSelected] = useState<Title | null>(null)
  const { library, ready, error, setList, remove } = useLibrary()
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
    let records: Record<string, MoveRecord> = {}
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
        setList(t, 'watched')
        records[key] = { to: 'watched', aired: i.aired, at: Date.now() }
        changed = true
      } else if (e.list === 'watched' && !i.ended && seen > 0 && seen < i.aired) {
        // new episodes came out for a show you were caught up on
        setList(t, 'watchlist')
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

  if (error) return <ServerDown />
  if (!ready) return <Splash text="Loading your library…" />

  return (
    <StatusContext.Provider value={{ library, info, count: ep.count }}>
      <div
        className="relative mx-auto min-h-full max-w-xl px-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 2rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 6.5rem)',
        }}
      >
        <TapEffects />
        <UserMenu username={session.username} canLogout={session.authRequired} />

        <div key={tab} className="anim-fade">
          {tab === 'watchlist' && <Watchlist library={library} info={info} ep={ep} onSelect={setSelected} />}
          {tab === 'upcoming' && <Upcoming library={library} info={info} onSelect={setSelected} />}
          {tab === 'discover' && <Discover onSelect={setSelected} />}
          {tab === 'watched' && <Watched library={library} onSelect={setSelected} />}
        </div>

        <TabBar active={tab} onChange={setTab} />

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
      </div>
    </StatusContext.Provider>
  )
}