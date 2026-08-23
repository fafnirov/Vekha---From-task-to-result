/** Точка входа сервера Vekha. */

import Fastify, { type FastifyError } from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { prisma } from './lib/prisma.js'
import { CLIENT_DIR, MAX_UPLOAD_BYTES } from './lib/paths.js'
import { authRoutes } from './routes/auth.js'
import { taskRoutes } from './routes/tasks.js'
import { boardRoutes } from './routes/board.js'
import { projectRoutes } from './routes/projects.js'
import { sprintRoutes } from './routes/sprints.js'
import { workspaceRoutes } from './routes/workspace.js'
import { workflowRoutes } from './routes/workflow.js'
import { filterRoutes } from './routes/filters.js'
import { reportRoutes } from './routes/reports.js'
import { feedRoutes } from './routes/feed.js'
import { startDailyJobs } from './jobs.js'

const PORT = Number(process.env.PORT ?? 4180)
const HOST = process.env.HOST ?? '127.0.0.1'

function requireSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret && secret.length >= 16) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET не задан или короче 16 символов — задайте его в .env')
  }
  console.warn('JWT_SECRET не задан, используется временный ключ разработки')
  return 'vekha-development-secret-key'
}

export async function build() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'production' ? true : { level: 'warn' },
    bodyLimit: 2 * 1024 * 1024,
  })

  await app.register(cookie)
  await app.register(jwt, { secret: requireSecret(), cookie: { cookieName: 'vekha_token', signed: false } })
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } })

  /* Заголовки безопасности для всех ответов. */
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'same-origin')
    reply.header('X-Frame-Options', 'DENY')
    return payload
  })

  app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }))

  await app.register(authRoutes)
  await app.register(taskRoutes)
  await app.register(boardRoutes)
  await app.register(projectRoutes)
  await app.register(sprintRoutes)
  await app.register(workspaceRoutes)
  await app.register(workflowRoutes)
  await app.register(filterRoutes)
  await app.register(reportRoutes)
  await app.register(feedRoutes)

  app.setErrorHandler((error: FastifyError, req, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: 'Некорректный запрос' })
    }
    req.log.error(error)
    // Наружу уходит только общая формулировка: подробности остаются в логе.
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
    reply.code(status).send({
      error: status >= 500 ? 'Внутренняя ошибка сервера' : error.message,
    })
  })

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Маршрут не найден' })
    }
    // Одностраничное приложение: любой другой путь отдаёт index.html.
    if (existsSync(CLIENT_DIR)) return reply.sendFile('index.html')
    return reply.code(404).send({ error: 'Клиент не собран, выполните npm run build' })
  })

  // В продакшене тот же процесс раздаёт собранный фронтенд.
  if (existsSync(CLIENT_DIR)) {
    await app.register(fastifyStatic, { root: CLIENT_DIR, prefix: '/' })
  }

  return app
}

async function main() {
  const app = await build()
  const stopJobs = startDailyJobs()

  const shutdown = async (signal: string) => {
    app.log.info(`${signal}: останавливаемся`)
    stopJobs()
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  await app.listen({ port: PORT, host: HOST })
  console.log(`API Vekha слушает http://${HOST}:${PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
