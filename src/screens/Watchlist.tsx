import type { useEpisodes } from '../lib/episodes'
import { keyOf, type Library } from '../lib/library'
import { img, type Info, type Title } from '../lib/tmdb'

interface Props {
  library: Library
  info: Record<string, Info>
  ep: ReturnType<typeof useEpisodes>
  onSelect: (t: Title) => void
}

export default function Watchlist({ library, info, ep, onSelect }: Props) {
  const items = Object.values(library)
    .filter((e) => e.list === 'watchlist')
    .map((e) => {
      const t = e.title
      const aired = info[keyOf(t)]?.aired ?? 0
      const seen = t.type === 'tv' ? Math.min(ep.count(keyOf(t)), aired) : 0
      return { t, aired, seen, behind: t.type === 'tv' && aired > seen }
    })
    // shows you're behind on come first
    .sort((a, b) => Number(b.behind) - Number(a.behind) || a.t.title.localeCompare(b.t.title))

  return (
    <div>
      <h2 className="mb-5 text-2xl font-semibold tracking-tight">
        Watchlist <span className="text-base font-normal text-[#8b8392]">{items.length}</span>
      </h2>

      {items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-[#8b8392]">Nothing here yet. Find something in Discover.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {items.map(({ t, aired, seen, behind }) => (
            <button
              key={keyOf(t)}
              onClick={() => onSelect(t)}
              className="text-left transition-transform active:scale-95"
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
              {behind && (
                <div className="mt-2">
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(seen / aired) * 100}%`, background: 'var(--accent)' }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[#8b8392]">
                    {seen} / {aired} eps
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}