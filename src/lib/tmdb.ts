const BASE = '/api/tmdb'

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
  const url = new URL(BASE + path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (res.status === 401) {
    window.location.reload() // session expired or signed out elsewhere; the login screen takes over
    throw new Error('Signed out')
  }
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
  airDate: string
}

export interface Episode {
  number: number
  name: string
  airDate: string
}

export async function showSeasons(id: number): Promise<Season[]> {
  const d = await get(`/tv/${id}`)
  return (
    d.seasons as { season_number: number; name: string; episode_count: number; air_date: string | null }[]
  )
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .map((s) => ({
      number: s.season_number,
      name: s.name,
      episodeCount: s.episode_count,
      airDate: s.air_date ?? '',
    }))
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
  ended: boolean // the show is finished or canceled (shows only)
  release: string // release date (movies) or premiere date (shows)
  next: { date: string; label: string; name: string } | null
  fetchedAt: number
}

interface RawEpisode {
  season_number: number
  episode_number: number
  name?: string
  air_date?: string | null
}

// TMDB's main release_date is the earliest premiere anywhere; prefer the theatrical date in your region
function regionalRelease(d: { release_dates?: { results?: { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[] } }): string {
  const region = d.release_dates?.results?.find((r) => r.iso_3166_1 === REGION)
  if (!region) return ''
  const pick = (types: number[]) =>
    region.release_dates
      .filter((r) => types.includes(r.type) && r.release_date)
      .map((r) => r.release_date.slice(0, 10))
      .sort()[0] ?? ''
  // 3 = theatrical, 2 = limited theatrical, 4 = digital (for streaming-only films)
  return pick([3]) || pick([2]) || pick([4])
}

export async function fetchInfo(t: Title): Promise<Info> {
  if (t.type === 'movie') {
    const d = await get(`/movie/${t.id}`, { append_to_response: 'release_dates' })
    const date = regionalRelease(d) || (d.release_date as string) || ''
    return {
      aired: 0,
      ended: false,
      release: date,
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
    ended: d.status === 'Ended' || d.status === 'Canceled',
    release: (d.first_air_date as string) || '',
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

// ---------- Discover: genres and streaming services ----------

export interface Genre {
  id: number
  name: string
}

export interface Provider {
  id: number
  name: string
  logo: string | null
}

export interface Filter {
  genre: number | null
  provider: number | null
}

// your region (from Settings) for release dates and streaming services
let REGION = 'US'
export const setRegion = (code: string) => {
  REGION = code
}

// the services shown first, in this order (matched by name against TMDB's live list)
const POPULAR_SERVICES: RegExp[] = [
  /^netflix$/i,
  /^amazon prime video$/i,
  /^apple tv(\+| plus)$/i,
  /^disney(\+| plus)$/i,
  /^(hbo )?max$/i,
  /^hulu$/i,
  /^paramount(\+| plus)$/i,
  /^peacock( premium)?$/i,
  /^crunchyroll$/i,
  /^starz$/i,
  /^amc\+?$/i,
  /^tubi( tv)?$/i,
  /^pluto tv$/i,
  /^shudder$/i,
]

export async function genres(type: MediaType): Promise<Genre[]> {
  const d = await get(`/genre/${type}/list`)
  return d.genres as Genre[]
}

export async function providers(type: MediaType): Promise<Provider[]> {
  const d = await get(`/watch/providers/${type}`, { watch_region: REGION })
  const list = (d.results ?? []) as {
    provider_id: number
    provider_name: string
    logo_path: string | null
    display_priority: number
    display_priorities?: Record<string, number>
  }[]
  const rank = (p: (typeof list)[number]) => p.display_priorities?.[REGION] ?? p.display_priority
  const sorted = [...list].sort((a, b) => rank(a) - rank(b))
  const toProvider = (p: (typeof list)[number]): Provider => ({
    id: p.provider_id,
    name: p.provider_name,
    logo: p.logo_path,
  })

  const picked: Provider[] = []
  for (const re of POPULAR_SERVICES) {
    const p = sorted.find((x) => re.test(x.provider_name.trim()))
    if (p && !picked.some((q) => q.id === p.provider_id)) picked.push(toProvider(p))
  }
  return picked.length >= 4 ? picked : sorted.slice(0, 12).map(toProvider)
}

export async function discover(type: MediaType, filter: Filter, page = 1): Promise<Title[]> {
  const params: Record<string, string> = {
    sort_by: 'popularity.desc',
    include_adult: 'false',
    page: String(page),
  }
  if (filter.genre) params.with_genres = String(filter.genre)
  if (filter.provider) {
    params.with_watch_providers = String(filter.provider)
    params.watch_region = REGION
    params.with_watch_monetization_types = 'flatrate'
  }
  const d = await get(`/discover/${type}`, params)
  return ((d.results ?? []) as RawResult[])
    .map((r) => normalize({ ...r, media_type: type }))
    .filter((t): t is Title => t !== null)
}

const genreCache = new Map<string, string[]>()

export async function titleGenres(type: MediaType, id: number): Promise<string[]> {
  const key = `${type}-${id}`
  const hit = genreCache.get(key)
  if (hit) return hit
  const d = await get(`/${type}/${id}`)
  const names = ((d.genres ?? []) as { name: string }[]).map((g) => g.name)
  genreCache.set(key, names)
  return names
}