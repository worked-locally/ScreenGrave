import type { Library } from './library'
import { discoverTitles, recommendations, type MediaType, type Title } from './tmdb'

// Friendly genres for onboarding and For You. TMDB numbers movie and TV genres differently,
// so each one maps to the matching ids on both sides (some only exist for one).
export interface GenreChoice {
  name: string
  movie: number[]
  tv: number[]
}

export const GENRE_CHOICES: GenreChoice[] = [
  { name: 'Action', movie: [28], tv: [10759] },
  { name: 'Adventure', movie: [12], tv: [10759] },
  { name: 'Animation', movie: [16], tv: [16] },
  { name: 'Comedy', movie: [35], tv: [35] },
  { name: 'Crime', movie: [80], tv: [80] },
  { name: 'Documentary', movie: [99], tv: [99] },
  { name: 'Drama', movie: [18], tv: [18] },
  { name: 'Family', movie: [10751], tv: [10751] },
  { name: 'Fantasy', movie: [14], tv: [10765] },
  { name: 'Horror', movie: [27], tv: [] },
  { name: 'Mystery', movie: [9648], tv: [9648] },
  { name: 'Reality', movie: [], tv: [10764] },
  { name: 'Romance', movie: [10749], tv: [] },
  { name: 'Sci-Fi', movie: [878], tv: [10765] },
  { name: 'Thriller', movie: [53], tv: [] },
  { name: 'War', movie: [10752], tv: [10768] },
  { name: 'Western', movie: [37], tv: [37] },
]

export function genreIds(type: MediaType, names: string[]): number[] {
  const ids = GENRE_CHOICES.filter((g) => names.includes(g.name)).flatMap((g) => g[type])
  return [...new Set(ids)]
}

const keyOf = (t: Title) => `${t.type}-${t.id}`

// a, b, a, b, ... without repeats
function interleave(a: Title[], b: Title[]): Title[] {
  const out: Title[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i])
    if (b[i]) out.push(b[i])
  }
  const seen = new Set<string>()
  return out.filter((t) => (seen.has(keyOf(t)) ? false : (seen.add(keyOf(t)), true)))
}

const unseen = (items: Title[], exclude: Set<string>) => items.filter((t) => !exclude.has(keyOf(t)) && t.poster)

// well-rated, popular movies and shows in one genre
export async function topPicks(genre: string, exclude: Set<string>): Promise<Title[]> {
  const g = GENRE_CHOICES.find((x) => x.name === genre)
  if (!g) return []
  const query = (type: MediaType) =>
    g[type].length
      ? discoverTitles(type, {
          with_genres: g[type].join('|'),
          sort_by: 'popularity.desc',
          'vote_average.gte': '7',
          'vote_count.gte': '300',
        })
      : Promise.resolve([])
  const [movies, shows] = await Promise.all([query('movie'), query('tv')])
  return unseen(interleave(movies, shows), exclude).slice(0, 20)
}

export async function becauseYouWatched(t: Title, exclude: Set<string>): Promise<Title[]> {
  return unseen(await recommendations(t), exclude).slice(0, 20)
}

// a couple of titles you finished recently, picked at random so the rows change between visits
export function seeds(library: Library, count = 2): Title[] {
  const recent = Object.values(library)
    .filter((e) => e.list === 'watched')
    .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
    .slice(0, 8)
    .map((e) => e.title)
  for (let i = recent.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[recent[i], recent[j]] = [recent[j], recent[i]]
  }
  return recent.slice(0, count)
}

// onboarding: the most-watched titles (most votes) in your genres, a good bet for "seen it"
export async function famous(type: MediaType, genres: string[], page = 1): Promise<Title[]> {
  const ids = genreIds(type, genres)
  if (genres.length && !ids.length) return []
  return discoverTitles(type, {
    sort_by: 'vote_count.desc',
    page: String(page),
    ...(ids.length ? { with_genres: ids.join('|') } : {}),
  })
}

// onboarding: shows people are watching right now
export async function airingNow(genres: string[], page = 1): Promise<Title[]> {
  const ids = genreIds('tv', genres)
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
  return discoverTitles('tv', {
    sort_by: 'popularity.desc',
    'air_date.gte': since,
    'vote_count.gte': '50',
    page: String(page),
    ...(ids.length ? { with_genres: ids.join('|') } : {}),
  })
}

export { interleave }
