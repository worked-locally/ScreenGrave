import { useState } from 'react'
import DetailSheet from './components/DetailSheet'
import TabBar, { type Tab } from './components/TabBar'
import TapEffects from './components/TapEffects'
import UserMenu from './components/UserMenu'
import { useEpisodes } from './lib/episodes'
import { keyOf, useLibrary } from './lib/library'
import { useShowInfo } from './lib/showinfo'
import { StatusContext } from './lib/status'
import { seasonEpisodes, showSeasons, type Title } from './lib/tmdb'
import Discover from './screens/Discover'
import Upcoming from './screens/Upcoming'
import Watched from './screens/Watched'
import Watchlist from './screens/Watchlist'

export default function App() {
  const [tab, setTab] = useState<Tab>('watchlist')
  const [selected, setSelected] = useState<Title | null>(null)
  const { library, ready, error, setList, remove } = useLibrary()
  const ep = useEpisodes()

  const watchlistTitles = Object.values(library)
    .filter((e) => e.list === 'watchlist')
    .map((e) => e.title)
  const info = useShowInfo(watchlistTitles)

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

  if (error) {
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

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="anim-fade text-sm tracking-wide text-[#8b8392]">Loading your library…</p>
      </div>
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
        <TapEffects />
        <UserMenu />

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