import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `/leapapi`, not `/api` — see the note in src/leap/api.js: /api is already taken on
  // the deployed host by another service, so requests there never reach the backend.
  // The backend mounts these routes under /portal-frontend-code, so the prefix is
  // swapped, not stripped.
  // The mypartydashboard.com PSA cadre-search service is called directly from the
  // browser (see src/leap/cadreSearchApi.js / cadreNotesApi.js) rather than proxied —
  // that service sends `Access-Control-Allow-Origin: *`, so no same-origin workaround
  // is needed the way it was for /leapapi.
  server: {
    port: 9001,
    host: '0.0.0.0',
    proxy: {
      '/leapapi': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/leapapi/, '/portal-frontend-code') },
    },
  },
  preview: {
    port: 9001,
    host: '0.0.0.0',
    allowedHosts: ['portalnew.mypartydashboard.com'],
    proxy: {
      '/leapapi': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/leapapi/, '/portal-frontend-code') },
    },
  },
})
