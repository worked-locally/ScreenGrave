export type Method = 'pin' | 'password' | 'none'

// what's wrong with a new PIN or password, or null when it's fine
export const secretProblem = (method: Method, secret: string): string | null =>
  method === 'pin' && !/^\d{4,8}$/.test(secret)
    ? 'A PIN is 4 to 8 numbers.'
    : method === 'password' && secret.length < 8
      ? 'Use at least 8 characters for a password.'
      : null

export interface Session {
  authRequired: boolean
  authenticated: boolean
  setupRequired: boolean // first run: nothing chosen yet
  method: Method // how you sign in
  passwordSource: 'env' | 'app' | 'off' // where that's set
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

async function post(path: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return null
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return data.error ?? `Something went wrong (${res.status}).`
  } catch {
    return "Couldn't reach the server."
  }
}

// returns null when it worked, otherwise a message to show
export const setupAccount = (displayName: string, method: Method, secret: string) =>
  post('/api/auth/setup', { displayName, method, secret })

export const changeMethod = (current: string, method: Method, secret: string) =>
  post('/api/auth/method', { current, method, secret })

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
}