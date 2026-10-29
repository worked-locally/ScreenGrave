import ScreenTitle from '../components/ScreenTitle'
import { keyOf, type Library } from '../lib/library'
import { img, type Info, type Title } from '../lib/tmdb'

interface Props {
  library: Library
  info: Record<string, Info>
  onSelect: (t: Title) => void
}

const todayStr = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

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

export default function Upcoming({ library, info, onSelect }: Props) {
  const today = todayStr()
  const watchlist = Object.values(library)
    .filter((e) => e.list === 'watchlist')
    .map((e) => e.title)

  const upcoming = watchlist
    .map((t) => ({ t, next: info[keyOf(t)]?.next }))
    .filter((x): x is { t: Title; next: NonNullable<Info['next']> } => !!x.next && x.next.date >= today)
    .sort((a, b) => a.next.date.localeCompare(b.next.date) || a.t.title.localeCompare(b.t.title))

  const loading = watchlist.filter((t) => !info[keyOf(t)]).length

  const groups: { date: string; items: typeof upcoming }[] = []
  for (const x of upcoming) {
    const g = groups[groups.length - 1]
    if (g && g.date === x.next.date) g.items.push(x)
    else groups.push({ date: x.next.date, items: [x] })
  }

  return (
    <div>
      <ScreenTitle title="Upcoming" icon="upcoming" />

      {loading > 0 && <p className="mb-4 text-xs text-[#8b8392]">Checking {loading} titles…</p>}

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
                    key={keyOf(t)}
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
    </div>
  )
}