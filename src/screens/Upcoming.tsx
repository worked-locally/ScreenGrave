import { useState } from 'react'
import ScreenTitle from '../components/ScreenTitle'
import { todayStr } from '../lib/dates'
import { keyOf, type Library } from '../lib/library'
import { img, type Info, type Title, type Upcoming as Item } from '../lib/tmdb'

interface Props {
  library: Library
  info: Record<string, Info>
  onSelect: (t: Title) => void
}

const RANGE_KEY = 'screengrave:upcoming-weeks'

// shown while show details are being refreshed; one is picked at random each time
const UPDATING = [
  'Updating titles…',
  'Checking the schedule…',
  'Asking the projectionist…',
  'Refreshing the marquee…',
  'Rewinding the tapes…',
  'Counting new episodes…',
  'Restocking the popcorn…',
  'Watching the trailers first…',
  'Waiting in line for popcorn…',
  'Standing in line for a soda…',
  'Waiting in line for the restroom…',
  'One quick restroom break before the movie…',
  'Waiting for showtime…',
  "I'll be back… with your episodes",
  'Hold on to your butts…',
  'Patience you must have…',
  'Just keep swimming…',
  'Wait for it…',
  'F*** Microsoft…',
  'Installing Windows updates… 1 of 247',
]

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('en-CA')

function savedWeeks(): 2 | 4 {
  try {
    return localStorage.getItem(RANGE_KEY) === '4' ? 4 : 2
  } catch {
    return 2
  }
}

function dayParts(date: string) {
  const d = new Date(`${date}T00:00:00`)
  const today = new Date(`${todayStr()}T00:00:00`)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  // show the year whenever the date isn't in the current year
  const year = d.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}

  let label: string
  if (diff === 0) label = 'Today'
  else if (diff === 1) label = 'Tomorrow'
  else if (diff < 7) label = d.toLocaleDateString(undefined, { weekday: 'long' })
  else label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...year })
  const short = diff < 7 ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...year }) : ''
  return { label, short }
}

// a show's entries for this range: every episode day inside it, or just its next episode when none fall inside
function entriesFor(i: Info | undefined, today: string, until: string): Item[] {
  if (!i?.next || i.next.date < today) return []
  const inside = (i.soon ?? []).filter((s) => s.date >= today && s.date <= until)
  return inside.length ? inside : [i.next]
}

export default function Upcoming({ library, info, onSelect }: Props) {
  const [weeks, setWeeksState] = useState<2 | 4>(savedWeeks)
  const [updating] = useState(() => UPDATING[Math.floor(Math.random() * UPDATING.length)])
  const setWeeks = (w: 2 | 4) => {
    setWeeksState(w)
    try {
      localStorage.setItem(RANGE_KEY, String(w))
    } catch {
      // storage unavailable; it just won't be remembered
    }
  }

  const today = todayStr()
  // your Watchlist plus caught-up shows in Watched, so their next episodes still show here
  const tracked = Object.values(library)
    .filter((e) => e.list === 'watchlist' || (e.list === 'watched' && e.title.type === 'tv'))
    .map((e) => e.title)

  const build = (until: string) =>
    tracked
      .flatMap((t) => entriesFor(info[keyOf(t)], today, until).map((next) => ({ t, next })))
      .sort((a, b) => a.next.date.localeCompare(b.next.date) || a.t.title.localeCompare(b.t.title))

  const upcoming = build(inDays(weeks * 7))
  // the button only shows when 4 weeks would actually add something
  const moreIn4 = weeks === 2 && build(inDays(28)).length > upcoming.length

  const loading = tracked.filter((t) => !info[keyOf(t)]).length

  const groups: { date: string; items: typeof upcoming }[] = []
  for (const x of upcoming) {
    const g = groups[groups.length - 1]
    if (g && g.date === x.next.date) g.items.push(x)
    else groups.push({ date: x.next.date, items: [x] })
  }

  return (
    <div>
      <ScreenTitle title="Upcoming" icon="upcoming" />

      {loading > 0 && <p className="mb-4 text-xs text-[#8b8392]">{updating}</p>}

      {groups.length === 0 && loading === 0 && (
        <p className="mt-16 text-center text-sm text-[#8b8392]">
          Nothing upcoming. New episodes and releases for your watchlist show up here.
        </p>
      )}

      <div>
        {groups.map((g, i) => {
          const { label, short } = dayParts(g.date)
          const last = i === groups.length - 1
          return (
            <section key={g.date} className="relative pb-6 pl-6">
              <span
                className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
              {!last && <span className="absolute bottom-0 left-[4.5px] top-5 w-px bg-white/10" />}
              <h3 className="mb-3 text-sm font-semibold">
                {label} {short && <span className="font-normal text-[#8b8392]">{short}</span>}
              </h3>
              <div className="space-y-2.5">
                {g.items.map(({ t, next }) => (
                  <button
                    key={`${keyOf(t)}-${next.date}`}
                    onClick={() => onSelect(t)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-[#16131a] p-2.5 text-left transition-transform active:scale-[0.98]"
                  >
                    {t.poster ? (
                      <img src={img(t.poster) ?? ''} alt="" className="h-20 w-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="h-20 w-14 shrink-0 rounded-lg bg-[#1f1a24]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--accent)' }}>
                        {next.label}
                      </p>
                      {next.name && <p className="truncate text-xs text-[#8b8392]">{next.name}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {(moreIn4 || weeks === 4) && groups.length > 0 && (
        <button
          onClick={() => setWeeks(weeks === 2 ? 4 : 2)}
          className="mx-auto mt-2 block rounded-full bg-[#1f1a24] px-5 py-2 text-sm font-medium text-[#cdc6bd] transition-transform active:scale-95"
        >
          {weeks === 2 ? 'Show 4 weeks' : 'Show 2 weeks'}
        </button>
      )}
    </div>
  )
}
