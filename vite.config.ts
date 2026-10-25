import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: { host: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ScreenGrave',
        short_name: 'ScreenGrave',
        description: 'Track your shows and movies',
        display: 'standalone',
        background_color: '#0c0a0f',
        theme_color: '#0c0a0f',
        start_url: '/',
      },
    }),
  ],
})