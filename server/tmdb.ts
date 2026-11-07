export const TMDB_TOKEN = process.env.TMDB_TOKEN ?? process.env.VITE_TMDB_TOKEN ?? ''

export interface Title {
  id: number
  type: 'movie' | 'tv'
  title: string
  year: string
  poster: string | null
  backdrop: string | null
  overview: string
  rating: number
}

export async function tmdbGet(path: string) {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`)
  return res.json()
}

// same shape the app uses, so imported titles look exactly like ones added by hand
export async function fetchTitle(type: 'movie' | 'tv', id: number): Promise<Title> {
  const d = await tmdbGet(`/${type}/${id}`)
  const date: string = (type === 'movie' ? d.release_date : d.first_air_date) || ''
  return {
    id,
    type,
    title: d.title || d.name || 'Untitled',
    year: date.slice(0, 4),
    poster: d.poster_path ?? null,
    backdrop: d.backdrop_path ?? null,
    overview: d.overview ?? '',
    rating: Math.round((d.vote_average ?? 0) * 10) / 10,
  }
}