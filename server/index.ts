import './env'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { existsSync } from 'node:fs'
import { api } from './api'
import { auth, AUTH_REQUIRED, requireAuth } from './auth'
import { TMDB_TOKEN } from './tmdb'
import { trakt } from './trakt'

const PORT = Number(process.env.PORT ?? 8787)
if (!TMDB_TOKEN) console.warn('[screengrave] TMDB_TOKEN is not set, so TMDB requests will fail.')
if (!AUTH_REQUIRED) console.warn('[screengrave] APP_PASSWORD is not set, so login is turned off.')

const app = new Hono()

// every /api route below needs a signed-in session (health and /api/auth are exempt)
app.use('/api/*', requireAuth)

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/api/auth', auth)
app.route('/api/trakt', trakt)

// TMDB proxy: the browser calls /api/tmdb/..., and the server adds the token
app.get('/api/tmdb/*', async (c) => {
  const url = new URL(c.req.url)
  const path = url.pathname.replace(/^\/api\/tmdb/, '')
  if (!/^\/[\w\-/]*$/.test(path)) return c.json({ error: 'bad path' }, 400)

  const res = await fetch(`https://api.themoviedb.org/3${path}${url.search}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' },
  })
  return new Response(res.body, {
    // a TMDB 401 means a bad token, not a signed-out user, so it shouldn't trigger the login screen
    status: res.status === 401 ? 502 : res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'private, max-age=300',
    },
  })
})

// library and episode progress
app.route('/api', api)

// unknown API routes get a real 404 instead of the app page
app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

// in production, the server also serves the built app from /dist
if (existsSync('dist')) {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[screengrave] server running on http://localhost:${info.port}`)
})