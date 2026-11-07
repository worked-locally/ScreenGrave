import type { Title } from '../lib/tmdb'
import Poster from './Poster'
import { SkeletonGrid } from './Skeleton'

interface Props {
  items: Title[]
  onSelect: (t: Title) => void
  empty?: string
  loading?: boolean // show placeholders instead of the empty message
}

export default function PosterGrid({ items, onSelect, empty, loading }: Props) {
  if (items.length === 0 && loading) return <SkeletonGrid />
  if (items.length === 0) {
    return <p className="mt-16 text-center text-sm text-[#8b8392]">{empty ?? 'Nothing here yet.'}</p>
  }
  return (
    <div className="grid grid-cols-3 items-start gap-3">
      {items.map((t) => (
        <button
          key={`${t.type}-${t.id}`}
          data-poster
          onClick={() => onSelect(t)}
          className="text-left transition-transform active:scale-95"
        >
          <Poster title={t} />
        </button>
      ))}
    </div>
  )
}