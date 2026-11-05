export interface Prefs {
  displayName: string
  region: string
  twoWaySync: boolean
}

export async function getPrefs(): Promise<Prefs> {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  return res.json() as Promise<Prefs>
}

export async function savePrefs(change: Partial<Prefs>): Promise<Prefs> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(change),
  })
  if (!res.ok) throw new Error(`Couldn't save settings (${res.status})`)
  return res.json() as Promise<Prefs>
}

// regions TMDB has good release-date and streaming data for
export const REGIONS: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'PH', name: 'Philippines' },
]
