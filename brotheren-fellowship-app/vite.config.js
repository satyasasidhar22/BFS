import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Brotheren Fellowship App',
        short_name: 'Fellowship Songs',
        description: 'Telugu Christian Song Book and Offline Audio Player',
        theme_color: '#1e3a8a',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Supabase API calls (fallback if offline)
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 14 // 14 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});