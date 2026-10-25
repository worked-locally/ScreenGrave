import { img, type Title } from '../lib/tmdb'

interface Props {
  items: Title[]
  onSelect: (t: Title) => void
  empty?: string
}

export default function PosterGrid({ items, onSelect, empty }: Props) {
  if (items.length === 0) {
    return <p className="mt-16 text-center text-sm text-[#8b8392]">{empty ?? 'Nothing here yet.'}</p>
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((t) => (
        <button
          key={`${t.type}-${t.id}`}
          onClick={() => onSelect(t)}
          className="text-left active:scale-95 transition-transform"
        >
          {t.poster ? (
            <img
              src={img(t.poster) ?? ''}
              alt={t.title}
              loading="lazy"
              className="aspect-[2/3] w-full rounded-xl bg-[#1f1a24] object-cover"
            />
          ) : (
            <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-[#1f1a24] p-2 text-center text-xs text-[#8b8392]">
              {t.title}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}