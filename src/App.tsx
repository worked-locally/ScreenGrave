import { useState } from 'react'
import DetailSheet from './components/DetailSheet'
import TabBar, { type Tab } from './components/TabBar'
import TapEffects from './components/TapEffects'
import { useEpisodes } from './lib/episodes'
import { keyOf, useLibrary } from './lib/library'
import { useShowInfo } from './lib/showinfo'
import { StatusContext } from './lib/status'
import { seasonEpisodes, showSeasons, type Title } from './lib/tmdb'
import Discover from './screens/Discover'
import Upcoming from './screens/Upcoming'
import Watched from './screens/Watched'
import Watchlist from './screens/Watchlist'
import UserMenu from './components/UserMenu'

export default function App() {
  const [tab, setTab] = useState<Tab>('watchlist')
  const [selected, setSelected] = useState<Title | null>(null)
  const { library, setList, remove } = useLibrary()
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