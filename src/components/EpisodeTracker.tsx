import { useEffect, useState } from 'react'
import type { useEpisodes } from '../lib/episodes'
import { seasonEpisodes, showSeasons, type Episode, type Season, type Title } from '../lib/tmdb'
import ScrollRow from './ScrollRow'

interface Props {
  show: Title
  ep: ReturnType<typeof useEpisodes>
  onActivity: () => void
}

const todayStr = () => new Date().toLocaleDateString('en-CA')

// the first started season you haven't finished, otherwise the latest started season
function pickSeason(seasons: Season[], watchedIn: (season: number) => number): number {
  const t = todayStr()
  const started = seasons.filter((s) => !s.airDate || s.airDate <= t)
  const open = started.find((s) => watchedIn(s.number) < s.episodeCount)
  return (open ?? started[started.length - 1] ?? seasons[0]).number
}

export default function EpisodeTracker({ show, ep, onActivity }: Props) {
  const showKey = `tv-${show.id}`
  const [seasons, setSeasons] = useState<Season[]>([])
  const [season, setSeason] = useState(1)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    showSeasons(show.id)
      .then((s) => {
        if (cancelled) return
        setSeasons(s)
        if (s.length) setSeason(pickSeason(s, (n) => ep.seasonCount(showKey, n)))
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.id])

  useEffect(() => {
    if (!seasons.length) return
    let cancelled = false
    seasonEpisodes(show.id, season)
      .then((e) => !cancelled && setEpisodes(e))
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [show.id, season, seasons.length])

  const today = todayStr()
  const aired = (e: Episode) => !e.airDate || e.airDate <= today
  const airedNumbers = episodes.filter(aired).map((e) => e.number)
  const watchedCount = airedNumbers.filter((n) => ep.isWatched(showKey, season, n)).length
  const allWatched = airedNumbers.length > 0 && watchedCount === airedNumbers.length

  if (error) return <p className="mt-6 text-sm text-red-400">{error}</p>
  if (!seasons.length) return null

  return (
    <div className="mt-8">
      <ScrollRow className="mb-3 gap-2 pb-1" centerActive={`${season}-${seasons.length}`}>
        {seasons.map((s) => (
          <button
            key={s.number}
            data-active={season === s.number}
            onClick={() => setSeason(s.number)}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium"
            style={
              season === s.number
                ? { background: 'var(--accent)', color: '#1a1008' }
                : { background: '#1f1a24', color: '#8b8392' }
            }
          >
            S{s.number}
          </button>
        ))}
      </ScrollRow>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest tabular-nums text-[#8b8392]">
          {watchedCount} / {airedNumbers.length} watched
        </p>
        <button
          onClick={() => {
            ep.markSeason(showKey, season, airedNumbers, !allWatched)
            if (!allWatched) onActivity()
          }}
          className="text-sm"
          style={{ color: 'var(--accent)' }}
        >
          {allWatched ? 'Unmark season' : 'Mark season watched'}
        </button>
      </div>

      <div>
        {episodes.map((e) => {
          const done = ep.isWatched(showKey, season, e.number)
          const isAired = aired(e)
          return (
            <button
              key={e.number}
              disabled={!isAired}
              onClick={() => {
                ep.toggle(showKey, season, e.number)
                if (!done) onActivity()
              }}
              className="flex w-full items-center gap-3 border-b border-white/5 py-3 text-left disabled:opacity-40"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs"
                style={
                  done
                    ? { background: 'var(--done)', borderColor: 'var(--done)', color: '#1a1008' }
                    : { borderColor: '#3a3340', color: 'transparent' }
                }
              >
                ✓
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  <span className="text-[#8b8392]">E{e.number}</span> {e.name}
                </span>
                {e.airDate && <span className="text-xs text-[#6b6473]">{e.airDate}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}