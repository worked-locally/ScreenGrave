import { useState } from 'react'
import DetailSheet from './components/DetailSheet'
import TabBar, { type Tab } from './components/TabBar'
import TapEffects from './components/TapEffects'
import { useEpisodes } from './lib/episodes'
import { keyOf, useLibrary } from './lib/library'
import { useShowInfo } from './lib/showinfo'
import type { Title } from './lib/tmdb'
import Discover from './screens/Discover'
import ListScreen from './screens/ListScreen'
import Upcoming from './screens/Upcoming'
import Watchlist from './screens/Watchlist'

export default function App() {
  const [tab, setTab] = useState<Tab>('watchlist')
  const [selected, setSelected] = useState<Title | null>(null)
  const { library, setList, remove } = useLibrary()
  const ep = useEpisodes()

  const watchlistTitles = Object.values(library)
    .filter((e) => e.list === 'watchlist')
    .map((e) => e.title)
  const info = useShowInfo(watchlistTitles)

  return (
    <div
      className="mx-auto min-h-full max-w-xl px-4 pb-28"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <TapEffects />

      <div key={tab} className="anim-fade">
        {tab === 'watchlist' && <Watchlist library={library} info={info} ep={ep} onSelect={setSelected} />}
        {tab === 'upcoming' && <Upcoming library={library} info={info} onSelect={setSelected} />}
        {tab === 'discover' && <Discover onSelect={setSelected} />}
        {tab === 'watched' && <ListScreen list="watched" library={library} onSelect={setSelected} />}
      </div>

      <TabBar active={tab} onChange={setTab} />

      {selected && (
        <DetailSheet
          title={selected}
          current={library[keyOf(selected)]?.list}
          onClose={() => setSelected(null)}
          onSet={(list) => setList(selected, list)}
          onRemove={() => remove(selected)}
          ep={ep}
        />
      )}
    </div>
  )
}