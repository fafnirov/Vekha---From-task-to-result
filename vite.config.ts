import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = process.env.VITE_API_URL ?? 'http://127.0.0.1:4180'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  server: {
    port: 5173,
    // В разработке фронтенд и API живут на разных портах; прокси делает
    // так, что в коде клиента везде используются относительные пути /api.
    proxy: {
      '/api': { target: API, changeOrigin: true, ws: false },
    },
  },
})
