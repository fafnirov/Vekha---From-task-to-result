import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = process.env.VITE_API_URL ?? 'http://127.0.0.1:4180'

/**
 * Префикс, под которым приложение живёт за обратным прокси.
 * Пусто — корень сайта; «/vekha» — раздел внутри чужого домена.
 * Одно и то же значение читают сборка, роутер и сервер.
 */
const BASE = (process.env.BASE_PATH ?? '').replace(/\/$/, '')

export default defineConfig({
  plugins: [react()],
  base: BASE ? `${BASE}/` : '/',
  build: { outDir: 'dist', sourcemap: false },
  server: {
    // Явный IPv4: иначе Vite слушает только ::1, и обращения к
    // 127.0.0.1 из скриптов и прокси не проходят.
    host: '127.0.0.1',
    port: 5173,
    // В разработке фронтенд и API живут на разных портах; прокси делает
    // так, что в коде клиента везде используются относительные пути /api.
    proxy: {
      '/api': { target: API, changeOrigin: true, ws: false },
    },
  },
})
