/** Главная, уведомления, лента активности, поиск и поток изменений. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { COOKIE_NAME, authenticate, requireTaskView } from '../lib/auth.js'
import {
  feedDto,
  notificationDto,
  projectDto,
  sprintDto,
  taskDto,
  taskInclude,
} from '../lib/dto.js'
import { bus, type ChangeEvent } from '../lib/events.js'
import { PROJECT_PALETTE } from '../lib/constants.js'
import { projectScope, taskScope } from '../lib/access.js'
import { relativeTime, shortDate, startOfDay } from '../lib/format.js'

const activityInclude = {
  actor: { select: { name: true, code: true } },
  task: { select: { key: true } },
} as const

const notificationInclude = {
  actor: { select: { code: true, name: true } },
  task: { select: { key: true } },
} as const

/** Причины попадания задачи в список «Требует внимания». */
const REASONS = {
  overdue: { reason: 'просрочено', icon: 'schedule', bg: 'var(--dang-bg)', fg: 'var(--dang)', bar: 'var(--dang)' },
  blocked: { reason: 'заблокировано', icon: 'block', bg: 'var(--dang-bg)', fg: 'var(--dang)', bar: 'var(--dang)' },
  today: { reason: 'срок сегодня', icon: 'today', bg: 'var(--warn-bg)', fg: 'var(--warn)', bar: 'var(--warn)' },
  soon: { reason: 'срок близко', icon: 'event', bg: 'var(--warn-bg)', fg: 'var(--warn)', bar: 'var(--warn)' },
  mention: { reason: 'упоминание', icon: 'alternate_email', bg: 'var(--ac-soft)', fg: 'var(--ac-tx)', bar: 'var(--ac)' },
  review: { reason: 'ждёт решения', icon: 'rate_review', bg: 'var(--ac-soft)', fg: 'var(--ac-tx)', bar: 'var(--ac)' },
  noassignee: { reason: 'без исполнителя', icon: 'person_off', bg: 'var(--n-bg)', fg: 'var(--tx2)', bar: 'var(--border2)' },
} as const

type ReasonKind = keyof typeof REASONS

export async function feedRoutes(app: FastifyInstance): Promise<void> {
  /* ── Поток изменений ──────────────────────────────────────────────── */

  /**
   * SSE-канал. Держит соединение открытым и шлёт короткие сообщения о том,
   * какая часть данных изменилась; клиент сам решает, что перезапросить.
   */
  app.get('/api/events', async (req, reply) => {
    const token = req.cookies?.[COOKIE_NAME]
    if (!token) return reply.code(401).send({ error: 'Требуется вход' })

    let userId: string
    try {
      const payload = app.jwt.verify<{ sub: string }>(token)
      userId = payload.sub
    } catch {
      return reply.code(401).send({ error: 'Сессия истекла' })
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    reply.raw.write(': connected\n\n')

    const onChange = (event: ChangeEvent) => {
      if (event.userId && event.userId !== userId) return
      reply.raw.write(`data: ${JSON.stringify({ scope: event.scope, id: event.id })}\n\n`)
    }
    bus.on('change', onChange)

    // Комментарий раз в 25 секунд не даёт прокси закрыть простаивающий канал.
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000)

    req.raw.on('close', () => {
      clearInterval(ping)
      bus.off('change', onChange)
    })

    return reply
  })

  /* ── Всё остальное требует входа ──────────────────────────────────── */

  app.register(async (scoped) => {
    scoped.addHook('preHandler', authenticate)

    /** Сводка для главного экрана. */
    scoped.get('/api/dashboard', { preHandler: requireTaskView }, async (req) => {
      const me = req.user!
      const now = new Date()
      const today = startOfDay(now)
      const soon = new Date(today.getTime() + 3 * 86_400_000)

      const [myTasks, allOpen, projects, activeSprint, activity, mentions] = await Promise.all([
        prisma.task.findMany({
          where: { assigneeId: me.id, status: { category: { not: 'done' } }, ...taskScope(me) },
          include: taskInclude,
          orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
          take: 12,
        }),
        prisma.task.findMany({
          where: { status: { category: { not: 'done' } }, ...taskScope(me) },
          include: taskInclude,
        }),
        /*
         * На главной — только свои проекты: те, где человек руководитель
         * или исполняет хотя бы одну задачу. Полный список живёт на
         * экране «Проекты»; сводка, показывающая заодно чужое, перестаёт
         * быть сводкой.
         *
         * Условия сложены через AND, а не разлиты по объекту: у
         * projectScope свой ключ OR, и он затёрся бы соседним.
         */
        prisma.project.findMany({
          where: {
            AND: [
              { state: { in: ['active', 'risk', 'release'] } },
              projectScope(me),
              { OR: [{ leadId: me.id }, { tasks: { some: { assigneeId: me.id } } }] },
            ],
          },
          include: {
            lead: { select: { code: true } },
            queue: { select: { key: true } },
            milestones: { orderBy: { date: 'asc' } },
            tasks: { select: { id: true, status: { select: { category: true } } } },
          },
          orderBy: { createdAt: 'asc' },
          take: 6,
        }),
        prisma.sprint.findFirst({
          where: { state: 'active' },
          include: {
            queue: { select: { key: true } },
            tasks: {
              select: { estimate: true, assigneeId: true, status: { select: { category: true } } },
            },
          },
          orderBy: { startDate: 'desc' },
        }),
        prisma.activity.findMany({
          include: activityInclude,
          orderBy: { createdAt: 'desc' },
          take: 12,
        }),
        prisma.notification.findMany({
          where: { userId: me.id, kind: { in: ['mention', 'comment', 'review', 'link'] } },
          include: notificationInclude,
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ])

      /* Список «Требует внимания»: у каждой строки своя причина. */
      const mentionKeys = new Set(
        mentions.filter((m) => m.readAt === null && m.task).map((m) => m.task!.key),
      )

      const attention: { key: string; kind: ReasonKind; meta: string; task: ReturnType<typeof taskDto> }[] = []
      const seen = new Set<string>()

      const push = (key: string, kind: ReasonKind, meta: string) => {
        if (seen.has(key)) return
        const row = allOpen.find((t) => t.key === key)
        if (!row) return
        seen.add(key)
        attention.push({ key, kind, meta, task: taskDto(row, now) })
      }

      for (const t of allOpen) {
        if (t.dueDate && t.dueDate < today) push(t.key, 'overdue', relativeTime(t.dueDate, now))
      }
      for (const t of allOpen) {
        if (t.status.category === 'blocked') push(t.key, 'blocked', t.status.name)
      }
      for (const t of allOpen) {
        if (t.dueDate && startOfDay(t.dueDate).getTime() === today.getTime()) {
          push(t.key, 'today', 'сегодня')
        }
      }
      for (const key of mentionKeys) {
        const t = allOpen.find((x) => x.key === key)
        if (t) push(key, 'mention', relativeTime(t.updatedAt, now))
      }
      for (const t of allOpen) {
        // Проверка отличается от прочей работы только именем статуса:
        // категория у них общая. Переименуете статус в настройках —
        // блок «ждёт решения» перестанет его замечать.
        if (t.status.name === 'На проверке' && t.assigneeId === me.id) {
          push(t.key, 'review', relativeTime(t.updatedAt, now))
        }
      }
      for (const t of allOpen) {
        if (!t.assigneeId) push(t.key, 'noassignee', shortDate(t.dueDate))
      }
      for (const t of allOpen) {
        if (t.dueDate && t.dueDate > today && t.dueDate <= soon) {
          push(t.key, 'soon', shortDate(t.dueDate))
        }
      }

      const overdueCount = allOpen.filter((t) => t.dueDate && t.dueDate < today).length
      const myOverdue = myTasks.filter((t) => t.dueDate && t.dueDate < today).length
      const reviewCount = allOpen.filter((t) => t.status.name === 'На проверке').length
      const blockedCount = allOpen.filter((t) => t.status.category === 'blocked').length

      return {
        kpis: [
          {
            label: 'Мои открытые',
            value: myTasks.length,
            note: myOverdue ? `${myOverdue} просрочено` : 'без просрочек',
            fg: myOverdue ? 'var(--dang)' : 'var(--ok)',
            icon: 'assignment_ind',
          },
          {
            label: 'На проверке',
            value: reviewCount,
            note: 'по всей организации',
            fg: 'var(--warn)',
            icon: 'rate_review',
          },
          {
            label: 'Заблокировано',
            value: blockedCount,
            note: blockedCount ? 'нужен разбор' : 'чисто',
            fg: blockedCount ? 'var(--dang)' : 'var(--ok)',
            icon: 'block',
          },
          {
            label: 'Просрочено',
            value: overdueCount,
            note: 'срок в прошлом',
            fg: overdueCount ? 'var(--dang)' : 'var(--ok)',
            icon: 'schedule',
          },
        ],
        attention: attention.slice(0, 12),
        reasons: REASONS,
        myTasks: myTasks.map((t) => taskDto(t, now)),
        projects: projects.map((p, i) => projectDto(p, i, PROJECT_PALETTE)),
        sprint: activeSprint
          ? {
              ...sprintDto(activeSprint),
              daysLeft: Math.max(
                0,
                Math.round((activeSprint.endDate.getTime() - now.getTime()) / 86_400_000),
              ),
            }
          : null,
        activity: activity.map((a) => feedDto(a, now)),
        mentions: mentions.map((m) => notificationDto(m, now)),
      }
    })

    /* ── Уведомления ────────────────────────────────────────────────── */

    /*
     * Уведомления правом task.view не закрыты намеренно: это личный
     * ящик человека — упоминания и назначения, адресованные лично ему.
     * Сама задача по ссылке всё равно не откроется.
     */
    scoped.get('/api/notifications', async (req) => {
      const p = z
        .object({
          unread: z.coerce.boolean().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(30),
        })
        .parse(req.query)

      const [rows, unread] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: req.user!.id, ...(p.unread ? { readAt: null } : {}) },
          include: notificationInclude,
          orderBy: { createdAt: 'desc' },
          take: p.limit,
        }),
        prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
      ])

      const now = new Date()
      return { items: rows.map((n) => notificationDto(n, now)), unread }
    })

    scoped.post('/api/notifications/read', async (req) => {
      const schema = z.object({ id: z.string().optional() })
      const parsed = schema.safeParse(req.body ?? {})
      const id = parsed.success ? parsed.data.id : undefined

      await prisma.notification.updateMany({
        where: { userId: req.user!.id, readAt: null, ...(id ? { id } : {}) },
        data: { readAt: new Date() },
      })
      return { ok: true }
    })

    /* ── Лента активности ───────────────────────────────────────────── */

    scoped.get('/api/activity', { preHandler: requireTaskView }, async (req) => {
      const p = z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(30),
          task: z.string().optional(),
          project: z.string().optional(),
        })
        .parse(req.query)

      const rows = await prisma.activity.findMany({
        where: {
          ...(p.task ? { task: { key: p.task.toUpperCase() } } : {}),
          ...(p.project ? { task: { project: { name: p.project } } } : {}),
        },
        include: activityInclude,
        orderBy: { createdAt: 'desc' },
        take: p.limit,
      })

      const now = new Date()
      return rows.map((a) => feedDto(a, now))
    })

    /* ── Поиск ──────────────────────────────────────────────────────── */

    /** Командная палитра: задачи, проекты, очереди и люди в одном ответе. */
    scoped.get('/api/search', { preHandler: requireTaskView }, async (req) => {
      const p = z.object({ q: z.string().default('') }).parse(req.query)
      const term = p.q.trim()
      if (term.length < 1) return { tasks: [], projects: [], queues: [], people: [] }

      const [tasks, projects, queues, people] = await Promise.all([
        prisma.task.findMany({
          where: {
            ...taskScope(req.user!),
            OR: [
              { key: { contains: term.toUpperCase() } },
              { title: { contains: term } },
              { description: { contains: term } },
            ],
          },
          include: taskInclude,
          orderBy: { updatedAt: 'desc' },
          take: 8,
        }),
        prisma.project.findMany({
          where: { name: { contains: term } },
          select: { id: true, name: true, abbr: true },
          take: 4,
        }),
        prisma.queue.findMany({
          where: { OR: [{ key: { contains: term.toUpperCase() } }, { name: { contains: term } }] },
          select: { id: true, key: true, name: true },
          take: 4,
        }),
        prisma.user.findMany({
          where: {
            active: true,
            OR: [{ name: { contains: term } }, { code: { contains: term.toUpperCase() } }],
          },
          select: { id: true, code: true, name: true, initials: true, jobTitle: true },
          take: 4,
        }),
      ])

      const now = new Date()
      return {
        tasks: tasks.map((t) => taskDto(t, now)),
        projects,
        queues,
        people,
      }
    })
  })
}
