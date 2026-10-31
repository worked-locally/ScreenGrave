export interface TraktStatus {
  configured: boolean
  connected: boolean
  lastSync: number | null
  redirectUri: string
}

export interface SyncResult {
  titles: number
  episodes: number
  skipped: number
}

export async function traktStatus(): Promise<TraktStatus> {
  const res = await fetch('/api/trakt/status')
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  return res.json() as Promise<TraktStatus>
}

export async function traktSync(): Promise<SyncResult> {
  const res = await fetch('/api/trakt/sync', { method: 'POST' })
  const body = (await res.json().catch(() => ({}))) as Partial<SyncResult> & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Sync failed (${res.status})`)
  return body as SyncResult
}

export async function traktDisconnect() {
  await fetch('/api/trakt/disconnect', { method: 'POST' })
}

// full-page trip to Trakt's sign-in; Trakt sends you back to the app afterwards
export function traktConnect() {
  window.location.href = '/api/trakt/connect'
}
