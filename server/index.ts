import './env'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { existsSync } from 'node:fs'
import { api } from './api'

const PORT = Number(process.env.PORT ?? 8787)
const TMDB_TOKEN = process.env.TMDB_TOKEN ?? process.env.VITE_TMDB_TOKEN ?? ''
if (!TMDB_TOKEN) console.warn('[screengrave] TMDB_TOKEN is not set, so TMDB requests will fail.')

const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true }))

// TMDB proxy: the browser calls /api/tmdb/..., and the server adds the token
app.get('/api/tmdb/*', async (c) => {
  const url = new URL(c.req.url)
  const path = url.pathname.replace(/^\/api\/tmdb/, '')
  if (!/^\/[\w\-/]*$/.test(path)) return c.json({ error: 'bad path' }, 400)

  const res = await fetch(`https://api.themoviedb.org/3${path}${url.search}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' },
  })
  return new Response(res.body, {
    status: res.status,
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