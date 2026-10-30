export interface Session {
  authRequired: boolean
  authenticated: boolean
  username: string
}

export async function getSession(): Promise<Session> {
  const res = await fetch('/api/auth/session')
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  return res.json() as Promise<Session>
}

export type LoginResult = 'ok' | 'wrong' | 'locked' | 'error'

export async function login(password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) return 'ok'
    if (res.status === 401) return 'wrong'
    if (res.status === 429) return 'locked'
    return 'error'
  } catch {
    return 'error'
  }
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
}