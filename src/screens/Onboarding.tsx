import { useEffect, useState } from 'react'
import GenrePicker from '../components/GenrePicker'
import { airingNow, famous, interleave } from '../lib/foryou'
import { img, search, showSeasons, type Season, type Title } from '../lib/tmdb'

// First-run walkthrough: what you like, what you've seen, what you're watching.
// Everything is optional. Someone who already has a library only sees the genre step.

export interface OnboardingResult {
  genres: string[]
  watched: Title[]
  watching: { title: Title; season: number }[]
}

interface Props {
  username: string
  existing: boolean // library already has titles (an upgrade, or after a Trakt import)
  traktConfigured: boolean
  onFinish: (r: OnboardingResult) => void
  onTrakt: (genres: string[]) => void
}

type Step = 'genres' | 'watched' | 'watching'

const keyOf = (t: Title) => `${t.type}-${t.id}`

function Tile({ t, badge, tone, onClick }: { t: Title; badge?: string; tone?: 'done' | 'accent'; onClick: () => void }) {
  const color = tone === 'done' ? 'var(--done)' : 'var(--accent)'
  return (
    <button onClick={onClick} className="relative text-left transition-transform active:scale-95" aria-pressed={!!badge}>
      {t.poster ? (
        <img
          src={img(t.poster) ?? ''}
          alt={t.title}
          loading="lazy"
          className="aspect-[2/3] w-full rounded-xl bg-[#1f1a24] object-cover transition-opacity"
          style={{ opacity: badge ? 0.45 : 1 }}
        />
      ) : (
        <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-[#1f1a24] p-2 text-center text-xs text-[#8b8392]">
          {t.title}
        </div>
      )}
      {badge && (
        <span
          className="absolute inset-0 flex items-center justify-center rounded-xl"
          style={{ boxShadow: `inset 0 0 0 2px ${color}` }}
        >
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: color, color: '#1a1008' }}>
            {badge}
          </span>
        </span>
      )}
    </button>
  )
}

// search box + grid; shows the suggestions until you type
function Picker({
  suggestions,
  tvOnly,
  badgeOf,
  onTap,
}: {
  suggestions: Title[]
  tvOnly?: boolean
  badgeOf: (t: Title) => { text: string; tone: 'done' | 'accent' } | null
  onTap: (t: Title) => void
}) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Title[] | null>(null)

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setFound(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      search(term)
        .then((r) => {
          if (!cancelled) setFound(r.filter((t) => (tvOnly ? t.type === 'tv' : true) && t.poster).slice(0, 18))
        })
        .catch(() => {})
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, tvOnly])

  const items = found ?? suggestions
  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tvOnly ? 'Search shows' : 'Search shows and movies'}
        enterKeyHint="search"
        autoComplete="off"
        className="mb-4 w-full rounded-2xl bg-[#1f1a24] px-4 py-3 text-base outline-none placeholder:text-[#8b8392]"
      />
      {items.length === 0 ? (
        <p className="mt-12 text-center text-sm text-[#8b8392]">{found ? 'No results.' : 'Loading…'}</p>
      ) : (
        <div className="grid grid-cols-3 items-start gap-3">
          {items.map((t) => {
            const b = badgeOf(t)
            return <Tile key={keyOf(t)} t={t} badge={b?.text} tone={b?.tone} onClick={() => onTap(t)} />
          })}
        </div>
      )}
    </>
  )
}

function SeasonPicker({ show, onPick, onClose }: { show: Title; onPick: (n: number) => void; onClose: () => void }) {
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  useEffect(() => {
    showSeasons(show.id)
      .then(setSeasons)
      .catch(() => setSeasons([]))
  }, [show.id])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div
        className="anim-sheet relative w-full max-w-xl rounded-t-3xl bg-[#16131a] px-5 pt-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <p className="text-lg font-semibold">{show.title}</p>
        <p className="mt-1 text-sm text-[#8b8392]">Which season are you on? Earlier seasons get checked off.</p>
        <div className="mt-4 flex max-h-64 flex-wrap gap-2 overflow-y-auto">
          {!seasons && <p className="text-sm text-[#8b8392]">Loading…</p>}
          {seasons?.length === 0 && (
            <button onClick={() => onPick(1)} className="rounded-full bg-[#1f1a24] px-4 py-2 text-sm text-[#cdc6bd]">
              Just started
            </button>
          )}
          {seasons?.map((s) => (
            <button
              key={s.number}
              onClick={() => onPick(s.number)}
              className="rounded-full bg-[#1f1a24] px-4 py-2 text-sm font-medium text-[#cdc6bd] transition-transform active:scale-95"
            >
              Season {s.number}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Onboarding({ username, existing, traktConfigured, onFinish, onTrakt }: Props) {
  const steps: Step[] = existing ? ['genres'] : ['genres', 'watched', 'watching']
  const [step, setStep] = useState<Step>('genres')
  const [genres, setGenres] = useState<string[]>([])
  const [watched, setWatched] = useState<Record<string, Title>>({})
  const [watching, setWatching] = useState<Record<string, { title: Title; season: number }>>({})
  const [famousList, setFamousList] = useState<Title[]>([])
  const [airingList, setAiringList] = useState<Title[]>([])
  const [asking, setAsking] = useState<Title | null>(null)

  const index = steps.indexOf(step)
  const last = index === steps.length - 1

  // suggestions follow the genres you picked
  useEffect(() => {
    if (step === 'watched' && famousList.length === 0) {
      Promise.all([famous('movie', genres, 1), famous('tv', genres, 1), famous('movie', genres, 2), famous('tv', genres, 2)])
        .then(([m1, t1, m2, t2]) => setFamousList(interleave([...m1, ...m2], [...t1, ...t2]).filter((t) => t.poster).slice(0, 36)))
        .catch(() => {})
    }
    if (step === 'watching' && airingList.length === 0) {
      Promise.all([airingNow(genres, 1), airingNow(genres, 2)])
        .then(([a, b]) => {
          const seen = new Set<string>()
          setAiringList(
            [...a, ...b]
              .filter((t) => t.poster && !watched[keyOf(t)] && !seen.has(keyOf(t)) && seen.add(keyOf(t)))
              .slice(0, 30),
          )
        })
        .catch(() => {})
    }
  }, [step, genres, famousList.length, airingList.length, watched])

  function next() {
    if (last) {
      onFinish({ genres, watched: Object.values(watched), watching: Object.values(watching) })
      return
    }
    setStep(steps[index + 1])
    window.scrollTo({ top: 0 })
  }

  function back() {
    if (index > 0) setStep(steps[index - 1])
    window.scrollTo({ top: 0 })
  }

  const count =
    step === 'genres' ? genres.length : step === 'watched' ? Object.keys(watched).length : Object.keys(watching).length
  const primary = last ? (existing ? 'Done' : 'Finish') : count ? 'Continue' : 'Skip'

  return (
    <div
      className="relative mx-auto min-h-full max-w-xl px-4"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 2rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 7rem)',
      }}
    >
      <div className="status-cover" aria-hidden="true" />

      {steps.length > 1 && (
        <div className="mb-6 flex gap-1.5" aria-label={`Step ${index + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <span
              key={s}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: i <= index ? 'var(--accent)' : '#262029' }}
            />
          ))}
        </div>
      )}

      <div key={step} className="anim-fade">
        {step === 'genres' && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">
              {existing ? 'New: For You' : `Hi${username ? ` ${username}` : ''}, what do you like to watch?`}
            </h1>
            <p className="mb-6 mt-1.5 text-sm leading-relaxed text-[#8b8392]">
              {existing
                ? 'Pick a few genres you like and Discover will suggest shows and movies for you.'
                : 'Pick a few. They shape the suggestions on Discover. You can change them later in Settings.'}
            </p>
            <GenrePicker value={genres} onChange={setGenres} />
          </>
        )}

        {step === 'watched' && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Seen any of these?</h1>
            <p className="mb-4 mt-1.5 text-sm leading-relaxed text-[#8b8392]">
              Tap everything you've already watched. Search for anything that's missing.
            </p>
            {traktConfigured && (
              <button
                onClick={() => onTrakt(genres)}
                className="mb-4 w-full rounded-2xl bg-[#1f1a24] px-4 py-3 text-left text-sm"
              >
                <span className="font-medium" style={{ color: 'var(--accent)' }}>
                  Import from Trakt instead
                </span>
                <span className="mt-0.5 block text-xs text-[#8b8392]">Bring in your history and watchlist in one go.</span>
              </button>
            )}
            <Picker
              suggestions={famousList}
              badgeOf={(t) => (watched[keyOf(t)] ? { text: 'Seen', tone: 'done' } : null)}
              onTap={(t) =>
                setWatched((w) => {
                  const n = { ...w }
                  if (n[keyOf(t)]) delete n[keyOf(t)]
                  else n[keyOf(t)] = t
                  return n
                })
              }
            />
          </>
        )}

        {step === 'watching' && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Watching anything right now?</h1>
            <p className="mb-4 mt-1.5 text-sm leading-relaxed text-[#8b8392]">
              Pick a show and the season you're on. It goes on your Watchlist.
            </p>
            <Picker
              tvOnly
              suggestions={airingList}
              badgeOf={(t) => {
                const w = watching[keyOf(t)]
                if (w) return { text: `Season ${w.season}`, tone: 'accent' }
                return watched[keyOf(t)] ? { text: 'Seen', tone: 'done' } : null
              }}
              onTap={(t) => {
                if (watching[keyOf(t)]) {
                  setWatching((w) => {
                    const n = { ...w }
                    delete n[keyOf(t)]
                    return n
                  })
                } else setAsking(t)
              }}
            />
          </>
        )}
      </div>

      {asking && (
        <SeasonPicker
          show={asking}
          onClose={() => setAsking(null)}
          onPick={(season) => {
            const t = asking
            setWatching((w) => ({ ...w, [keyOf(t)]: { title: t, season } }))
            setWatched((w) => {
              const n = { ...w }
              delete n[keyOf(t)]
              return n
            })
            setAsking(null)
          }}
        />
      )}

      <div
        className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#0c0a0f] via-[#0c0a0f] to-transparent pt-8"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4">
          {index > 0 && (
            <button onClick={back} className="px-2 py-3.5 text-sm text-[#8b8392]">
              Back
            </button>
          )}
          <button
            onClick={next}
            className="flex-1 rounded-2xl py-3.5 text-sm font-semibold transition-transform active:scale-[0.98]"
            style={
              count || last
                ? { background: 'var(--accent)', color: '#1a1008' }
                : { background: '#1f1a24', color: '#cdc6bd' }
            }
          >
            {primary}
            {count > 0 && step !== 'genres' ? ` (${count})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
