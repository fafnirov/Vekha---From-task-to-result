/** Спринты и планирование: бэклог, ёмкость команды, распределение нагрузки. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, require as requirePerm } from '../lib/auth.js'
import { personDto, sprintDto, taskDto, taskInclude } from '../lib/dto.js'
import { record } from '../lib/activity.js'
import { emitChanges } from '../lib/events.js'
import { startOfDay } from '../lib/format.js'

const sprintInclude = {
  queue: { select: { key: true } },
  tasks: {
    select: { estimate: true, assigneeId: true, status: { select: { category: true } } },
  },
} as const

export async function sprintRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  app.get('/api/sprints', async (req) => {
    const p = z.object({ queue: z.string().optional(), state: z.string().optional() }).parse(req.query)
    const rows = await prisma.sprint.findMany({
      where: {
        ...(p.queue ? { queue: { key: p.queue } } : {}),
        ...(p.state ? { state: { in: p.state.split(',') } } : {}),
      },
      include: sprintInclude,
      orderBy: { startDate: 'desc' },
    })
    return rows.map(sprintDto)
  })

  /**
   * Экран планирования: активный спринт слева, бэклог справа,
   * загрузка по людям снизу. Всё считается из настоящих задач.
   */
  app.get('/api/planning', async (req) => {
    const p = z.object({ sprint: z.string().optional(), queue: z.string().optional() }).parse(req.query)

    const sprint = p.sprint
      ? await prisma.sprint.findFirst({
          where: { OR: [{ id: p.sprint }, { name: p.sprint }] },
          include: sprintInclude,
        })
      : await prisma.sprint.findFirst({
          where: { state: 'active', ...(p.queue ? { queue: { key: p.queue } } : {}) },
          include: sprintInclude,
          orderBy: { startDate: 'desc' },
        })

    const now = new Date()

    const sprintTasks = sprint
      ? await prisma.task.findMany({
          where: { sprintId: sprint.id },
          include: taskInclude,
          orderBy: [{ rank: 'asc' }, { num: 'desc' }],
        })
      : []

    /* Бэклог — незакрытые задачи вне спринтов. */
    const backlogTasks = await prisma.task.findMany({
      where: {
        sprintId: null,
        status: { category: { not: 'done' } },
        ...(p.queue ? { queue: { key: p.queue } } : {}),
      },
      include: taskInclude,
      orderBy: [{ priority: 'asc' }, { rank: 'asc' }, { num: 'desc' }],
      take: 100,
    })

    /* Нагрузка: сколько story points назначено каждому в этом спринте. */
    const people = await prisma.user.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    })

    const perPerson = people.map((u) => {
      const mine = sprintTasks.filter((t) => t.assigneeId === u.id)
      const points = mine.reduce((sum, t) => sum + (t.estimate ?? 0), 0)
      const done = mine
        .filter((t) => t.status.category === 'done')
        .reduce((sum, t) => sum + (t.estimate ?? 0), 0)
      // Ёмкость одного человека — доля общей ёмкости спринта.
      const share = sprint && people.length ? Math.round(sprint.capacity / people.length) : 0
      return {
        ...personDto(u),
        points,
        done,
        capacity: share,
        overloaded: share > 0 && points > share,
        load: share > 0 ? Math.round((points / share) * 100) : 0,
      }
    })

    const planned = sprintTasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0)
    const unassigned = sprintTasks.filter((t) => !t.assigneeId).length
    const unestimated = sprintTasks.filter((t) => t.estimate === null).length

    return {
      sprint: sprint ? sprintDto(sprint) : null,
      sprintTasks: sprintTasks.map((t) => taskDto(t, now)),
      backlog: backlogTasks.map((t) => taskDto(t, now)),
      people: perPerson,
      summary: {
        planned,
        capacity: sprint?.capacity ?? 0,
        free: Math.max(0, (sprint?.capacity ?? 0) - planned),
        over: Math.max(0, planned - (sprint?.capacity ?? 0)),
        tasks: sprintTasks.length,
        unassigned,
        unestimated,
      },
      sprints: (
        await prisma.sprint.findMany({ include: sprintInclude, orderBy: { startDate: 'desc' } })
      ).map(sprintDto),
    }
  })

  app.post('/api/sprints', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return

    const schema = z.object({
      name: z.string().trim().min(2, 'Укажите название спринта'),
      queue: z.string().trim().min(1, 'Выберите очередь'),
      goal: z.string().default(''),
      startDate: z.string(),
      endDate: z.string(),
      capacity: z.number().int().min(0).max(999).default(0),
      state: z.enum(['planned', 'active', 'closed']).default('planned'),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }
    const body = parsed.data

    const queue = await prisma.queue.findFirst({
      where: { OR: [{ id: body.queue }, { key: body.queue.toUpperCase() }] },
    })
    if (!queue) return reply.code(400).send({ error: 'Очередь не найдена' })

    const start = new Date(body.startDate)
    const end = new Date(body.endDate)
    if (end <= start) return reply.code(400).send({ error: 'Дата окончания раньше даты начала' })

    // Активным может быть только один спринт очереди.
    if (body.state === 'active') {
      await prisma.sprint.updateMany({
        where: { queueId: queue.id, state: 'active' },
        data: { state: 'closed' },
      })
    }

    const created = await prisma.sprint.create({
      data: {
        name: body.name,
        queueId: queue.id,
        goal: body.goal,
        startDate: start,
        endDate: end,
        capacity: body.capacity,
        state: body.state,
      },
      include: sprintInclude,
    })

    emitChanges(['sprints'])
    return reply.code(201).send(sprintDto(created))
  })

  app.patch('/api/sprints/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      goal: z.string().optional(),
      capacity: z.number().int().min(0).max(999).optional(),
      state: z.enum(['planned', 'active', 'closed']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const sprint = await prisma.sprint.findUnique({ where: { id } })
    if (!sprint) return reply.code(404).send({ error: 'Спринт не найден' })

    if (parsed.data.state === 'active') {
      await prisma.sprint.updateMany({
        where: { queueId: sprint.queueId, state: 'active', id: { not: id } },
        data: { state: 'closed' },
      })
    }

    const updated = await prisma.sprint.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.goal !== undefined ? { goal: parsed.data.goal } : {}),
        ...(parsed.data.capacity !== undefined ? { capacity: parsed.data.capacity } : {}),
        ...(parsed.data.state ? { state: parsed.data.state } : {}),
        ...(parsed.data.startDate ? { startDate: new Date(parsed.data.startDate) } : {}),
        ...(parsed.data.endDate ? { endDate: new Date(parsed.data.endDate) } : {}),
      },
      include: sprintInclude,
    })

    emitChanges(['sprints', 'tasks'])
    return sprintDto(updated)
  })

  /** Добавление задачи в спринт и возврат в бэклог. */
  app.post('/api/sprints/:id/tasks', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({ key: z.string() })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Укажите задачу' })

    const [sprint, task] = await Promise.all([
      prisma.sprint.findUnique({ where: { id } }),
      prisma.task.findUnique({
        where: { key: parsed.data.key.toUpperCase() },
        include: { sprint: { select: { name: true } } },
      }),
    ])
    if (!sprint) return reply.code(404).send({ error: 'Спринт не найден' })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    await prisma.task.update({
      where: { id: task.id },
      data: { sprintId: sprint.id, rank: Date.now() },
    })
    await record({
      taskId: task.id,
      actorId: req.user!.id,
      kind: 'sprint',
      note: 'добавил(а) задачу в спринт',
      field: 'sprint',
      fromValue: task.sprint?.name ?? '—',
      toValue: sprint.name,
    })

    emitChanges(['sprints', 'tasks', 'board'], task.key)
    return { ok: true }
  })

  app.delete('/api/sprints/:id/tasks/:key', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return

    const { key } = req.params as { id: string; key: string }
    const task = await prisma.task.findUnique({
      where: { key: key.toUpperCase() },
      include: { sprint: { select: { name: true } } },
    })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    await prisma.task.update({ where: { id: task.id }, data: { sprintId: null } })
    await record({
      taskId: task.id,
      actorId: req.user!.id,
      kind: 'sprint',
      note: 'вернул(а) задачу в бэклог',
      field: 'sprint',
      fromValue: task.sprint?.name ?? '—',
      toValue: '—',
    })

    emitChanges(['sprints', 'tasks', 'board'], task.key)
    return { ok: true }
  })

  /**
   * Закрытие спринта: незавершённые задачи переносятся в следующий
   * спринт или возвращаются в бэклог.
   */
  app.post('/api/sprints/:id/close', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({ moveTo: z.string().nullable().default(null) })
    const parsed = schema.safeParse(req.body ?? {})
    const moveTo = parsed.success ? parsed.data.moveTo : null

    const sprint = await prisma.sprint.findUnique({ where: { id } })
    if (!sprint) return reply.code(404).send({ error: 'Спринт не найден' })

    const target = moveTo
      ? await prisma.sprint.findFirst({ where: { OR: [{ id: moveTo }, { name: moveTo }] } })
      : null

    const open = await prisma.task.findMany({
      where: { sprintId: sprint.id, status: { category: { not: 'done' } } },
      select: { id: true },
    })

    await prisma.task.updateMany({
      where: { id: { in: open.map((t) => t.id) } },
      data: { sprintId: target?.id ?? null },
    })
    await prisma.sprint.update({ where: { id }, data: { state: 'closed' } })

    emitChanges(['sprints', 'tasks', 'board'])
    return { closed: sprint.name, moved: open.length, movedTo: target?.name ?? null }
  })

  /**
   * Burndown активного спринта. Точки берутся из ежедневных срезов,
   * а сегодняшний остаток считается на лету — так график не «замерзает».
   */
  app.get('/api/sprints/:id/burndown', async (req, reply) => {
    const { id } = req.params as { id: string }
    const sprint = await prisma.sprint.findFirst({
      where: { OR: [{ id }, { name: decodeURIComponent(id) }] },
      include: { snapshots: { orderBy: { day: 'asc' } }, tasks: { include: { status: true } } },
    })
    if (!sprint) return reply.code(404).send({ error: 'Спринт не найден' })

    const total = sprint.tasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0)
    const remaining = sprint.tasks
      .filter((t) => t.status.category !== 'done')
      .reduce((sum, t) => sum + (t.estimate ?? 0), 0)

    const days = Math.max(
      1,
      Math.round((sprint.endDate.getTime() - sprint.startDate.getTime()) / 86_400_000),
    )

    const points = sprint.snapshots.map((s) => ({
      day: s.day.toISOString(),
      label: String(s.day.getDate()),
      remaining: s.remaining,
      ideal: s.ideal,
    }))

    const today = startOfDay(new Date())
    const hasToday = sprint.snapshots.some(
      (s) => startOfDay(s.day).getTime() === today.getTime(),
    )
    if (!hasToday && today >= startOfDay(sprint.startDate) && today <= sprint.endDate) {
      const elapsed = Math.round((today.getTime() - startOfDay(sprint.startDate).getTime()) / 86_400_000)
      points.push({
        day: today.toISOString(),
        label: String(today.getDate()),
        remaining,
        ideal: Math.max(0, Math.round(total * (1 - elapsed / days))),
      })
    }

    return { sprint: sprint.name, total, remaining, days, points }
  })
}
