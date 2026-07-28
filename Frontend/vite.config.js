import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `/leapapi`, not `/api` — see the note in src/leap/api.js: /api is already taken on
  // the deployed host by another service, so requests there never reach :8001.
  server: {
    port: 9001,
    host: '0.0.0.0',
    proxy: { '/leapapi': { target: 'http://127.0.0.1:8001', rewrite: (p) => p.replace(/^\/leapapi/, '') } },
  },
  preview: {
    port: 9001,
    host: '0.0.0.0',
    allowedHosts: ['portalnew.mypartydashboard.com'],
    proxy: { '/leapapi': { target: 'http://127.0.0.1:8001', rewrite: (p) => p.replace(/^\/leapapi/, '') } },
  },
})
