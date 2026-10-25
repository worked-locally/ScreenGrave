const TOKEN = import.meta.env.VITE_TMDB_TOKEN as string
const BASE = 'https://api.themoviedb.org/3'

export type MediaType = 'movie' | 'tv'

export interface Title {
  id: number
  type: MediaType
  title: string
  year: string
  poster: string | null
  backdrop: string | null
  overview: string
  rating: number
}

interface RawResult {
  id: number
  media_type?: string
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string
  vote_average?: number
}

export const img = (path: string | null, size = 'w342') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null

async function get(path: string, params: Record<string, string> = {}) {
  const url = new URL(BASE + path)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`TMDB error ${res.status}`)
  return res.json()
}

function normalize(r: RawResult): Title | null {
  if (r.media_type !== 'movie' && r.media_type !== 'tv') return null
  const date = r.release_date || r.first_air_date || ''
  return {
    id: r.id,
    type: r.media_type,
    title: r.title || r.name || 'Untitled',
    year: date.slice(0, 4),
    poster: r.poster_path ?? null,
    backdrop: r.backdrop_path ?? null,
    overview: r.overview ?? '',
    rating: Math.round((r.vote_average ?? 0) * 10) / 10,
  }
}

function toTitles(results: RawResult[]): Title[] {
  return results.map(normalize).filter((t): t is Title => t !== null)
}

export async function trending(): Promise<Title[]> {
  const data = await get('/trending/all/week')
  return toTitles(data.results)
}

export async function search(query: string): Promise<Title[]> {
  const data = await get('/search/multi', { query, include_adult: 'false' })
  return toTitles(data.results)
}

export interface Season {
  number: number
  name: string
  episodeCount: number
}

export interface Episode {
  number: number
  name: string
  airDate: string
}

export async function showSeasons(id: number): Promise<Season[]> {
  const d = await get(`/tv/${id}`)
  return (d.seasons as { season_number: number; name: string; episode_count: number }[])
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count }))
}

export async function seasonEpisodes(id: number, season: number): Promise<Episode[]> {
  const d = await get(`/tv/${id}/season/${season}`)
  return (d.episodes as { episode_number: number; name: string; air_date: string | null }[]).map((e) => ({
    number: e.episode_number,
    name: e.name,
    airDate: e.air_date ?? '',
  }))
}
export interface Info {
  aired: number // episodes aired so far (shows only)
  next: { date: string; label: string; name: string } | null
  fetchedAt: number
}

interface RawEpisode {
  season_number: number
  episode_number: number
  name?: string
  air_date?: string | null
}

export async function fetchInfo(t: Title): Promise<Info> {
  if (t.type === 'movie') {
    const d = await get(`/movie/${t.id}`)
    const date = (d.release_date as string) || ''
    return {
      aired: 0,
      next: date ? { date, label: 'Movie', name: 'Release' } : null,
      fetchedAt: Date.now(),
    }
  }

  const d = await get(`/tv/${t.id}`)
  const seasons = (d.seasons ?? []) as { season_number: number; episode_count: number }[]
  const last = d.last_episode_to_air as RawEpisode | null
  const nx = d.next_episode_to_air as RawEpisode | null

  let aired = 0
  if (last) {
    aired =
      seasons
        .filter((s) => s.season_number > 0 && s.season_number < last.season_number)
        .reduce((n, s) => n + s.episode_count, 0) + last.episode_number
  }

  return {
    aired,
    next: nx?.air_date
      ? { date: nx.air_date, label: `S${nx.season_number} · E${nx.episode_number}`, name: nx.name ?? '' }
      : null,
    fetchedAt: Date.now(),
  }
}

export async function trailerKey(type: MediaType, id: number): Promise<string | null> {
  const d = await get(`/${type}/${id}/videos`)
  const vids = ((d.results ?? []) as { key: string; site: string; type: string; official?: boolean }[]).filter(
    (v) => v.site === 'YouTube',
  )
  const pick =
    vids.find((v) => v.type === 'Trailer' && v.official) ??
    vids.find((v) => v.type === 'Trailer') ??
    vids.find((v) => v.type === 'Teaser')
  return pick?.key ?? null
}