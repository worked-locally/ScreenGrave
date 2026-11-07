import { getConnInfo } from '@hono/node-server/conninfo'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { Hono, type Context, type Next } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { db } from './db'
import { prefs, savePrefsDirect } from './settings'

// How you sign in:
//   APP_PASSWORD set     -> that password, from the server's settings file ("env"); can't be changed in the app
//   AUTH_DISABLED=true   -> no sign-in at all
//   neither              -> chosen in the app on first run: a PIN, a password, or no sign-in

export type Method = 'pin' | 'password' | 'none'

const ENV_PASSWORD = process.env.APP_PASSWORD ?? ''
const AUTH_DISABLED = /^(1|true|yes)$/i.test(process.env.AUTH_DISABLED ?? '')
const ENV_USERNAME = process.env.APP_USERNAME?.trim() || 'Guest'
export const PASSWORD_SOURCE: 'env' | 'app' | 'off' = AUTH_DISABLED ? 'off' : ENV_PASSWORD ? 'env' : 'app'

const COOKIE = 'sg_session'
const MAX_AGE = 30 * 24 * 60 * 60 // 30 days, in seconds

const sha256 = (s: string) => createHash('sha256').update(s).digest()

// ----- the method you chose (app-managed) -----

interface Stored {
  method: Method
  hash?: string // scrypt hash of the PIN or password
}

const getRow = db.prepare('SELECT value FROM settings WHERE key = ?')
const putRow = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
)

function stored(): Stored | null {
  const row = getRow.get('auth') as unknown as { value: string } | undefined
  if (row) return JSON.parse(row.value) as Stored
  // a password saved by the earlier 0.7 test build
  const old = getRow.get('auth_password') as unknown as { value: string } | undefined
  return old ? { method: 'password', hash: JSON.parse(old.value) as string } : null
}

function currentMethod(): Method | null {
  if (PASSWORD_SOURCE === 'off') return 'none'
  if (PASSWORD_SOURCE === 'env') return 'password'
  return stored()?.method ?? null // null = first run, nothing chosen yet
}

const setupRequired = () => currentMethod() === null

function hashSecret(secret: string): string {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('base64')}$${scryptSync(secret, salt, 32).toString('base64')}`
}

function checkSecret(given: string): boolean {
  if (PASSWORD_SOURCE === 'env') return timingSafeEqual(sha256(given), sha256(ENV_PASSWORD))
  const hash = stored()?.hash
  if (!hash) return false
  const [, saltB64, hashB64] = hash.split('$')
  const expected = Buffer.from(hashB64, 'base64')
  return timingSafeEqual(scryptSync(given, Buffer.from(saltB64, 'base64'), expected.length), expected)
}

// returns an error message, or null when the secret is fine for that method
function validate(method: Method, secret: string): string | null {
  if (method === 'pin' && !/^\d{4,8}$/.test(secret)) return 'A PIN is 4 to 8 numbers.'
  if (method === 'password' && secret.length < 8) return 'Use at least 8 characters for a password.'
  return null
}

function saveMethod(method: Method, secret: string) {
  const value: Stored = method === 'none' ? { method } : { method, hash: hashSecret(secret) }
  putRow.run('auth', JSON.stringify(value))
}

// ----- sessions -----
// Tied to the current secret, so changing it signs out every other device.

const secretKey = () => (PASSWORD_SOURCE === 'env' ? ENV_PASSWORD : (stored()?.hash ?? ''))
const hashToken = (token: string) => sha256(`${token}\0${secretKey()}`).toString('hex')

const insertSession = db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)')
const findSession = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?')
const dropExpired = db.prepare('DELETE FROM sessions WHERE expires_at < ?')
dropExpired.run(Date.now())

function isSignedIn(c: Context) {
  const method = currentMethod()
  if (method === 'none') return true
  if (method === null) return false
  const token = getCookie(c, COOKIE)
  if (!token) return false
  const row = findSession.get(hashToken(token)) as unknown as { expires_at: number } | undefined
  return !!row && row.expires_at > Date.now()
}

function startSession(c: Context) {
  const token = randomBytes(32).toString('base64url')
  insertSession.run(hashToken(token), Date.now() + MAX_AGE * 1000)
  const secure = new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https'
  setCookie(c, COOKIE, token, { httpOnly: true, sameSite: 'Lax', secure, path: '/', maxAge: MAX_AGE })
}

// ----- slow down guessing -----
// 8 wrong tries per 15 minutes from one address, and 30 from everyone combined,
// so a 4-digit PIN can't be worked through by spreading guesses over many addresses.

const WINDOW = 15 * 60 * 1000
const MAX_FAILS = 8
const MAX_FAILS_ALL = 30
const EVERYONE = '*'
const failures = new Map<string, { count: number; first: number }>()

// tidy up once an hour: expired sessions and old failure counts
setInterval(() => {
  const now = Date.now()
  dropExpired.run(now)
  for (const [k, v] of failures) if (now - v.first >= WINDOW) failures.delete(k)
}, 60 * 60 * 1000).unref()

function clientOf(c: Context) {
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

function over(key: string, max: number) {
  const prev = failures.get(key)
  return !!prev && Date.now() - prev.first < WINDOW && prev.count >= max
}

const tooManyAttempts = (who: string) => over(who, MAX_FAILS) || over(EVERYONE, MAX_FAILS_ALL)

function bump(key: string) {
  const now = Date.now()
  const prev = failures.get(key)
  const entry = prev && now - prev.first < WINDOW ? prev : { count: 0, first: now }
  entry.count++
  failures.set(key, entry)
}

async function recordFailure(who: string) {
  bump(who)
  bump(EVERYONE)
  await new Promise((r) => setTimeout(r, 500))
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

auth.get('/session', (c) => {
  const method = currentMethod()
  return c.json({
    authRequired: method !== 'none',
    authenticated: isSignedIn(c),
    setupRequired: method === null,
    method: method ?? 'pin',
    passwordSource: PASSWORD_SOURCE,
    username: prefs().displayName || ENV_USERNAME,
  })
})

const readBody = async (c: Context) =>
  ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const asMethod = (v: unknown): Method | null => (v === 'pin' || v === 'password' || v === 'none' ? v : null)

// first run: your name and how you want to sign in (only works until something is chosen)
auth.post('/setup', async (c) => {
  if (!setupRequired()) return c.json({ error: 'already set up' }, 409)
  const body = await readBody(c)
  const method = asMethod(body.method)
  if (!method) return c.json({ error: 'Choose how to sign in.' }, 400)
  const secret = str(body.secret)
  const problem = validate(method, secret)
  if (problem) return c.json({ error: problem }, 400)

  saveMethod(method, secret)
  const name = str(body.displayName).trim().slice(0, 24)
  if (name) savePrefsDirect({ displayName: name })
  if (method !== 'none') startSession(c)
  return c.json({ ok: true })
})

auth.post('/login', async (c) => {
  const method = currentMethod()
  if (method === 'none') return c.json({ ok: true })
  if (method === null) return c.json({ error: 'setup required' }, 409)

  const who = clientOf(c)
  if (tooManyAttempts(who)) return c.json({ error: 'too many attempts' }, 429)

  const body = await readBody(c)
  if (!checkSecret(str(body.password))) {
    await recordFailure(who)
    return c.json({ error: 'wrong' }, 401)
  }
  failures.delete(who)
  startSession(c)
  return c.json({ ok: true })
})

// change how you sign in, from Settings; other devices are signed out, this one stays in
auth.post('/method', async (c) => {
  if (PASSWORD_SOURCE !== 'app') return c.json({ error: 'Sign-in is set on the server.' }, 409)
  if (!isSignedIn(c)) return c.json({ error: 'not signed in' }, 401)

  const who = clientOf(c)
  if (tooManyAttempts(who)) return c.json({ error: 'Too many attempts. Try again in a few minutes.' }, 429)

  const body = await readBody(c)
  const method = asMethod(body.method)
  if (!method) return c.json({ error: 'Choose how to sign in.' }, 400)

  // confirm it's you, unless there was no sign-in to begin with
  if (currentMethod() !== 'none' && !checkSecret(str(body.current))) {
    await recordFailure(who)
    return c.json({ error: 'Your current PIN or password is wrong.' }, 403)
  }
  const secret = str(body.secret)
  const problem = validate(method, secret)
  if (problem) return c.json({ error: problem }, 400)

  saveMethod(method, secret)
  db.exec('DELETE FROM sessions')
  if (method !== 'none') startSession(c)
  return c.json({ ok: true })
})

auth.post('/logout', (c) => {
  const token = getCookie(c, COOKIE)
  if (token) deleteSession.run(hashToken(token))
  deleteCookie(c, COOKIE, { path: '/' })
  return c.json({ ok: true })
})
