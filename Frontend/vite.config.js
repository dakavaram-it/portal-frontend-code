import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9001,
    host: '0.0.0.0',
    proxy: { '/api': { target: 'http://127.0.0.1:8001', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  preview: {
    port: 9001,
    host: '0.0.0.0',
    proxy: { '/api': { target: 'http://127.0.0.1:8001', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
})
