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
  // The WebService/CommitteeWebService resource (src/leap/committeeApi.js) is
  // different: its OPTIONS preflight sends no CORS headers at all, so the browser
  // blocks every request to it before it's sent, no matter what headers we attach.
  // That's a server-side gap on mypartydashboard.com, so it's routed through this
  // same-origin proxy instead — Vite's Node process makes the actual cross-origin
  // call, which isn't subject to browser CORS.
  // The PC-Meetings module (src/pcm) is a second backend on the same gateway,
  // mounted at /pc-meetings — same swap, its own prefix.
  // Dashboard 2 (src/leap/dashboard2Api.js) is a third: same gateway, mounted at
  // /portal-frontend-code-2. It is a separate backend from /leapapi, not a route on
  // it — read-only, unauthenticated, and it takes its scope as query parameters.
  server: {
    port: 9001,
    host: '0.0.0.0',
    proxy: {
      '/leapapi': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/leapapi/, '/portal-frontend-code') },
      '/pcmapi': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/pcmapi/, '/pc-meetings') },
      '/dash2api': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/dash2api/, '/portal-frontend-code-2') },
      '/partyAnalystApi': {
        target: 'https://www.mypartydashboard.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/partyAnalystApi/, ''),
      },
    },
  },
  preview: {
    port: 9001,
    host: '0.0.0.0',
    allowedHosts: ['portalnew.mypartydashboard.com'],
    proxy: {
      '/leapapi': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/leapapi/, '/portal-frontend-code') },
      '/pcmapi': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/pcmapi/, '/pc-meetings') },
      '/dash2api': { target: 'http://127.0.0.1:6644', rewrite: (p) => p.replace(/^\/dash2api/, '/portal-frontend-code-2') },
      '/partyAnalystApi': {
        target: 'https://www.mypartydashboard.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/partyAnalystApi/, ''),
      },
    },
  },
})
