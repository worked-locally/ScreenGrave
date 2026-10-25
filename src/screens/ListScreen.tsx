import PosterGrid from '../components/PosterGrid'
import type { Library, ListName } from '../lib/library'
import type { Title } from '../lib/tmdb'

const LABELS: Record<ListName, string> = {
  watchlist: 'Watchlist',
  watching: 'Watching',
  watched: 'Watched',
}

interface Props {
  list: ListName
  library: Library
  onSelect: (t: Title) => void
}

export default function ListScreen({ list, library, onSelect }: Props) {
  const items = Object.values(library)
    .filter((e) => e.list === list)
    .map((e) => e.title)

  return (
    <div>
      <h2 className="mb-5 text-2xl font-semibold tracking-tight">
        {LABELS[list]} <span className="text-base font-normal text-[#8b8392]">{items.length}</span>
      </h2>
      <PosterGrid items={items} onSelect={onSelect} empty="Nothing here yet. Add titles from Discover." />
    </div>
  )
}