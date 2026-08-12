import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `/leapapi`, not `/api` — see the note in src/leap/api.js: /api is already taken on
  // the deployed host by another service, so requests there never reach the backend.
  // The backend mounts these routes under /portal-frontend-code, so the prefix is
  // swapped, not stripped.
  // `/psaapi` fronts the separate mypartydashboard.com cadre-search service (not the
  // /leapapi backend). Proxied here rather than called directly from the browser so the
  // request is same-origin — that service's CORS policy is out of this repo's control.
  server: {
    port: 9001,
    host: '0.0.0.0',
    proxy: {
      '/leapapi': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/leapapi/, '/portal-frontend-code') },
      '/psaapi': { target: 'https://www.mypartydashboard.com', changeOrigin: true, rewrite: (p) => p.replace(/^\/psaapi/, '/PSA') },
    },
  },
  preview: {
    port: 9001,
    host: '0.0.0.0',
    allowedHosts: ['portalnew.mypartydashboard.com'],
    proxy: {
      '/leapapi': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/leapapi/, '/portal-frontend-code') },
      '/psaapi': { target: 'https://www.mypartydashboard.com', changeOrigin: true, rewrite: (p) => p.replace(/^\/psaapi/, '/PSA') },
    },
  },
})
