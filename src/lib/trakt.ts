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

// ----- device sign-in -----

export interface DeviceCode {
  userCode: string
  verificationUrl: string
  interval: number
  expiresIn: number
}

export type DevicePoll = 'pending' | 'slow_down' | 'connected' | 'denied' | 'expired' | 'error'

export async function traktDeviceStart(): Promise<DeviceCode> {
  const res = await fetch('/api/trakt/device/start', { method: 'POST' })
  const body = (await res.json().catch(() => ({}))) as Partial<DeviceCode> & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Couldn't start Trakt sign-in (${res.status})`)
  return body as DeviceCode
}

export async function traktDevicePoll(): Promise<DevicePoll> {
  const res = await fetch('/api/trakt/device/poll', { method: 'POST' })
  if (!res.ok) return 'error'
  const body = (await res.json().catch(() => ({}))) as { status?: DevicePoll }
  return body.status ?? 'error'
}
