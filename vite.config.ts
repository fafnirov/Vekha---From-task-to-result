import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  /*
   * Читаем .env целиком, а не только переменные с префиксом VITE_:
   * BASE_PATH нужен и серверу, и сборке, и держать его в двух местах —
   * верный способ однажды собрать клиент с путями от корня и получить
   * пустую страницу за прокси.
   */
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }

  const API = env.VITE_API_URL ?? 'http://127.0.0.1:4180'

  /** Префикс, под которым приложение живёт: '' — корень, '/vekha' — раздел. */
  const base = (env.BASE_PATH ?? '').trim().replace(/\/+$/, '')

  return {
    plugins: [react()],
    base: base ? `${base}/` : '/',
    build: { outDir: 'dist', sourcemap: false },
    server: {
      // Явный IPv4: иначе Vite слушает только ::1, и обращения к
      // 127.0.0.1:5173 из скриптов и прокси не проходят.
      host: '127.0.0.1',
      port: 5173,
      // В разработке клиент и API живут на разных портах; прокси делает
      // так, что в коде везде используются относительные пути /api.
      proxy: {
        '/api': { target: API, changeOrigin: true, ws: false },
      },
    },
  }
})
