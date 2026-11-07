import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

// a new id for every build, so an installed app can tell when the server has a newer one
const BUILD_ID = String(Date.now())

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    host: true,
    proxy: {
      // keep the browser's own address on proxied requests, so the server's same-site check sees one site
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
    },
  },
  plugins: [
    {
      // writes dist/build.json, which the app checks on start to catch stale cached copies
      name: 'screengrave-build-id',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ build: BUILD_ID, version }) })
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32x32.png', 'apple-touch-icon.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'ScreenGrave',
        short_name: 'ScreenGrave',
        description: 'Track your shows and movies',
        display: 'standalone',
        background_color: '#0c0a0f',
        theme_color: '#0c0a0f',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})