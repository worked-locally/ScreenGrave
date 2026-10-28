import { useReleaseDate, useStatusOf } from '../lib/status'
import { img, type Title } from '../lib/tmdb'
import StatusBadge from './StatusBadge'

const pretty = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export default function Poster({ title }: { title: Title }) {
  const statusOf = useStatusOf()
  const releaseOf = useReleaseDate()
  const status = statusOf(title)
  const date = status === 'upcoming' ? releaseOf(title) : null

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

      {status === 'upcoming' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/90 via-black/60 to-transparent px-1.5 pb-2 pt-8 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#cdc6bd]">Not out yet</p>
          {date && <p className="text-[11px] font-semibold leading-tight text-[#efe9df]">{pretty(date)}</p>}
        </div>
      )}

      <StatusBadge status={status} />
    </div>
  )
}