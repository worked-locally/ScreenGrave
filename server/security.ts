import type { Context, Next } from 'hono'

// ----- browser protections on every response -----
// What the page may load: only itself, TMDB images, and YouTube for trailers.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React sets some styles inline
  "img-src 'self' data: blob: https://image.tmdb.org",
  "font-src 'self'",
  "connect-src 'self'",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  "media-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // nobody can show ScreenGrave inside their own page
].join('; ')

export async function securityHeaders(c: Context, next: Next) {
  await next()
  const h = c.res.headers
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('X-Frame-Options', 'DENY')
  h.set('Referrer-Policy', 'same-origin')
  h.set('Cross-Origin-Opener-Policy', 'same-origin')
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  if ((h.get('content-type') ?? '').includes('text/html')) h.set('Content-Security-Policy', CSP)
  // signed-in data should never sit in a shared cache (TMDB answers set their own short cache)
  if (c.req.path.startsWith('/api/') && !c.req.path.startsWith('/api/tmdb/')) h.set('Cache-Control', 'no-store')
}

// ----- only ScreenGrave's own pages may change things -----
// Blocks other websites (including other apps on the same domain) from sending
// changes on your behalf while you're signed in.
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function sameOrigin(c: Context, next: Next) {
  if (SAFE.has(c.req.method)) return next()
  if (c.req.header('sec-fetch-site') === 'cross-site') return c.json({ error: 'cross-site request blocked' }, 403)
  const origin = c.req.header('origin')
  if (origin) {
    const host = (c.req.header('x-forwarded-host') ?? c.req.header('host') ?? '').split(',')[0].trim()
    let originHost = ''
    try {
      originHost = new URL(origin).host
    } catch {
      // not a valid origin
    }
    if (!host || originHost !== host) return c.json({ error: 'cross-site request blocked' }, 403)
  }
  return next()
}

// outgoing requests give up instead of hanging forever
export const timeout = (ms = 15_000) => AbortSignal.timeout(ms)
