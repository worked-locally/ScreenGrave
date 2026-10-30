import { getConnInfo } from '@hono/node-server/conninfo'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Hono, type Context, type Next } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { db } from './db'

const PASSWORD = process.env.APP_PASSWORD ?? ''
const USERNAME = process.env.APP_USERNAME?.trim() || 'Guest'
export const AUTH_REQUIRED = PASSWORD.length > 0

const COOKIE = 'sg_session'
const MAX_AGE = 30 * 24 * 60 * 60 // 30 days, in seconds

const sha256 = (s: string) => createHash('sha256').update(s).digest()
// tied to the current password, so changing APP_PASSWORD signs out every device
const hashToken = (token: string) => sha256(`${token}\0${PASSWORD}`).toString('hex')

const insertSession = db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)')
const findSession = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?')
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())

function isSignedIn(c: Context) {
  if (!AUTH_REQUIRED) return true
  const token = getCookie(c, COOKIE)
  if (!token) return false
  const row = findSession.get(hashToken(token)) as unknown as { expires_at: number } | undefined
  return !!row && row.expires_at > Date.now()
}

// ----- slow down password guessing -----

const WINDOW = 15 * 60 * 1000
const MAX_FAILS = 8
const failures = new Map<string, { count: number; first: number }>()

function clientOf(c: Context) {
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

// ----- middleware: everything under /api needs a session, except health and auth itself -----

export async function requireAuth(c: Context, next: Next) {
  const path = c.req.path
  if (path === '/api/health' || path.startsWith('/api/auth/')) return next()
  if (isSignedIn(c)) return next()
  return c.json({ error: 'not signed in' }, 401)
}

// ----- routes -----

export const auth = new Hono()

auth.get('/session', (c) =>
  c.json({ authRequired: AUTH_REQUIRED, authenticated: isSignedIn(c), username: USERNAME }),
)

auth.post('/login', async (c) => {
  if (!AUTH_REQUIRED) return c.json({ ok: true })

  const who = clientOf(c)
  const now = Date.now()
  const prev = failures.get(who)
  const recent = prev && now - prev.first < WINDOW ? prev : undefined
  if (recent && recent.count >= MAX_FAILS) return c.json({ error: 'too many attempts' }, 429)

  const body = (await c.req.json().catch(() => null)) as { password?: unknown } | null
  const given = typeof body?.password === 'string' ? body.password : ''

  if (!timingSafeEqual(sha256(given), sha256(PASSWORD))) {
    const entry = recent ?? { count: 0, first: now }
    entry.count++
    failures.set(who, entry)
    await new Promise((r) => setTimeout(r, 500))
    return c.json({ error: 'wrong password' }, 401)
  }

  failures.delete(who)
  const token = randomBytes(32).toString('base64url')
  insertSession.run(hashToken(token), now + MAX_AGE * 1000)

  const secure = new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https'
  setCookie(c, COOKIE, token, { httpOnly: true, sameSite: 'Lax', secure, path: '/', maxAge: MAX_AGE })
  return c.json({ ok: true })
})

auth.post('/logout', (c) => {
  const token = getCookie(c, COOKIE)
  if (token) deleteSession.run(hashToken(token))
  deleteCookie(c, COOKIE, { path: '/' })
  return c.json({ ok: true })
})