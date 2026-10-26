import Poster from '../components/Poster'
import type { useEpisodes } from '../lib/episodes'
import { keyOf, type Library } from '../lib/library'
import type { Info, Title } from '../lib/tmdb'
import ScreenTitle from '../components/ScreenTitle'

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
      <ScreenTitle title="Watchlist" count={items.length} />
      
      {items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-[#8b8392]">Nothing here yet. Find something in Discover.</p>
      ) : (
        <div className="grid grid-cols-3 items-start gap-3">
          {items.map(({ t, aired, seen, behind }) => (
            <button
              key={keyOf(t)}
              onClick={() => onSelect(t)}
              className="text-left transition-transform active:scale-95"
            >
              <Poster title={t} />
              {behind && (
                <div className="mt-2">
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(seen / aired) * 100}%`, background: 'var(--accent)' }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-[#8b8392]">
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