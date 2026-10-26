import { useStatusOf } from '../lib/status'
import { img, type Title } from '../lib/tmdb'
import StatusBadge from './StatusBadge'

export default function Poster({ title }: { title: Title }) {
  const statusOf = useStatusOf()
  return (
    <div className="relative">
      {title.poster ? (
        <img
          src={img(title.poster) ?? ''}
          alt={title.title}
          loading="lazy"
          className="aspect-[2/3] w-full rounded-xl bg-[#1f1a24] object-cover"
        />
      ) : (
        <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-[#1f1a24] p-2 text-center text-xs text-[#8b8392]">
          {title.title}
        </div>
      )}
      <StatusBadge status={statusOf(title)} />
    </div>
  )
}