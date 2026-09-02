/** Проекты, вехи и диаграмма Ганта. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, require as requirePerm, requireTaskView } from '../lib/auth.js'
import { milestoneDto, projectDto, taskDto, taskInclude } from '../lib/dto.js'
import { emitChanges } from '../lib/events.js'
import { PROJECT_PALETTE, PROJECT_STATES } from '../lib/constants.js'
import { abbrFrom, longDate, shortDate, startOfDay } from '../lib/format.js'

const projectInclude = {
  lead: { select: { code: true } },
  queue: { select: { key: true } },
  milestones: { orderBy: { date: 'asc' } },
  tasks: { select: { id: true, status: { select: { category: true } } } },
} as const

const MONTHS = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

/** Позиция даты в колонках диаграммы: целое — месяц, дробь — день внутри. */
function column(date: Date, origin: Date): number {
  const months = (date.getFullYear() - origin.getFullYear()) * 12 + (date.getMonth() - origin.getMonth())
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return months + (date.getDate() - 1) / daysInMonth
}

const CATEGORY_COLOR: Record<string, string> = {
  done: 'var(--ok)',
  inprogress: 'var(--ac)',
  todo: 'var(--info)',
  blocked: 'var(--dang)',
}

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  app.get('/api/projects', async () => {
    const rows = await prisma.project.findMany({
      include: projectInclude,
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((p, i) => projectDto(p, i, PROJECT_PALETTE))
  })

  app.get('/api/projects/:name', { preHandler: requireTaskView }, async (req, reply) => {
    const { name } = req.params as { name: string }
    const decoded = decodeURIComponent(name)

    const all = await prisma.project.findMany({
      include: projectInclude,
      orderBy: { createdAt: 'asc' },
    })
    const index = all.findIndex((p) => p.name === decoded || p.id === decoded)
    if (index === -1) return reply.code(404).send({ error: 'Проект не найден' })
    const project = all[index]

    const tasks = await prisma.task.findMany({
      where: { projectId: project.id },
      include: taskInclude,
      orderBy: [{ status: { order: 'asc' } }, { num: 'desc' }],
    })

    const now = new Date()
    const milestones = project.milestones.map((m) => milestoneDto(m, longDate))

    /* ── Диаграмма Ганта ────────────────────────────────────────────── */

    const dated = tasks.filter((t) => t.dueDate)
    const bounds: Date[] = [
      ...(project.startDate ? [project.startDate] : []),
      ...(project.dueDate ? [project.dueDate] : []),
      ...dated.map((t) => t.createdAt),
      ...dated.map((t) => t.dueDate!),
      ...project.milestones.map((m) => m.date),
    ]

    let gantt: unknown[] = []
    let header: string[] = []

    if (bounds.length > 0) {
      const min = new Date(Math.min(...bounds.map((d) => d.getTime())))
      const max = new Date(Math.max(...bounds.map((d) => d.getTime())))
      const origin = new Date(min.getFullYear(), min.getMonth(), 1)
      const span = Math.max(
        3,
        (max.getFullYear() - origin.getFullYear()) * 12 + (max.getMonth() - origin.getMonth()) + 1,
      )

      header = Array.from({ length: span }, (_, i) => {
        const d = new Date(origin.getFullYear(), origin.getMonth() + i, 1)
        return MONTHS[d.getMonth()]
      })

      const taskRows = dated.map((t) => {
        const from = t.createdAt < t.dueDate! ? t.createdAt : t.dueDate!
        const start = column(startOfDay(from), origin)
        const end = column(startOfDay(t.dueDate!), origin)
        const done = t.status.category === 'done'
        return {
          label: `${t.key} · ${t.title}`,
          key: t.key,
          start,
          dur: Math.max(0.3, end - start),
          pct: done ? '100%' : t.status.category === 'inprogress' ? '50%' : '0%',
          c: CATEGORY_COLOR[t.status.category] ?? 'var(--info)',
          who: t.assignee?.code ?? '',
          dates: `${shortDate(from)} – ${shortDate(t.dueDate!)}`,
          status: t.status.name,
        }
      })

      const milestoneRows = project.milestones.map((m) => ({
        label: `Веха · ${m.title}`,
        start: column(startOfDay(m.date), origin),
        dur: 0.35,
        pct: '',
        c: 'var(--vio)',
        who: '',
        dates: shortDate(m.date),
        milestone: true,
      }))

      gantt = [...taskRows, ...milestoneRows].sort(
        (a, b) => (a as { start: number }).start - (b as { start: number }).start,
      )
    }

    return {
      project: projectDto(project, index, PROJECT_PALETTE),
      tasks: tasks.map((t) => taskDto(t, now)),
      milestones,
      gantt,
      ganttHeader: header,
      /* Риски считаются по данным, а не заводятся руками. */
      risks: [
        ...(tasks.some((t) => t.status.category === 'blocked')
          ? [
              {
                title: 'Есть заблокированные задачи',
                note: tasks
                  .filter((t) => t.status.category === 'blocked')
                  .map((t) => t.key)
                  .join(', '),
                level: 'high' as const,
              },
            ]
          : []),
        ...(tasks.some((t) => t.dueDate && t.dueDate < now && t.status.category !== 'done')
          ? [
              {
                title: 'Просроченные задачи',
                note: tasks
                  .filter((t) => t.dueDate && t.dueDate < now && t.status.category !== 'done')
                  .map((t) => t.key)
                  .join(', '),
                level: 'high' as const,
              },
            ]
          : []),
        ...(tasks.some((t) => !t.assigneeId && t.status.category !== 'done')
          ? [
              {
                title: 'Задачи без исполнителя',
                note: tasks
                  .filter((t) => !t.assigneeId && t.status.category !== 'done')
                  .map((t) => t.key)
                  .join(', '),
                level: 'medium' as const,
              },
            ]
          : []),
        ...(tasks.some((t) => t.estimate === null && t.status.category !== 'done')
          ? [
              {
                title: 'Не проставлены оценки',
                note: `${tasks.filter((t) => t.estimate === null && t.status.category !== 'done').length} задач без story points`,
                level: 'low' as const,
              },
            ]
          : []),
      ],
    }
  })

  app.post('/api/projects', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return

    const schema = z.object({
      name: z.string().trim().min(2, 'Укажите название'),
      queue: z.string().trim().min(1, 'Выберите очередь'),
      lead: z.string().trim().min(1, 'Выберите руководителя'),
      description: z.string().default(''),
      state: z.enum(PROJECT_STATES).default('active'),
      startDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      abbr: z.string().trim().max(3).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }
    const body = parsed.data

    const [queue, lead] = await Promise.all([
      prisma.queue.findFirst({ where: { OR: [{ id: body.queue }, { key: body.queue.toUpperCase() }] } }),
      prisma.user.findFirst({ where: { OR: [{ id: body.lead }, { code: body.lead }] } }),
    ])
    if (!queue) return reply.code(400).send({ error: 'Очередь не найдена' })
    if (!lead) return reply.code(400).send({ error: 'Руководитель не найден' })

    const exists = await prisma.project.findUnique({ where: { name: body.name } })
    if (exists) return reply.code(409).send({ error: 'Проект с таким названием уже есть' })

    const created = await prisma.project.create({
      data: {
        name: body.name,
        abbr: body.abbr || abbrFrom(body.name),
        description: body.description,
        queueId: queue.id,
        leadId: lead.id,
        state: body.state,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
      include: projectInclude,
    })

    emitChanges(['projects'])
    const count = await prisma.project.count()
    return reply.code(201).send(projectDto(created, count - 1, PROJECT_PALETTE))
  })

  app.patch('/api/projects/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      description: z.string().optional(),
      state: z.enum(PROJECT_STATES).optional(),
      lead: z.string().optional(),
      startDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })
    const body = parsed.data

    const lead = body.lead
      ? await prisma.user.findFirst({ where: { OR: [{ id: body.lead }, { code: body.lead }] } })
      : null

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.state ? { state: body.state } : {}),
        ...(lead ? { leadId: lead.id } : {}),
        ...(body.startDate !== undefined
          ? { startDate: body.startDate ? new Date(body.startDate) : null }
          : {}),
        ...(body.dueDate !== undefined
          ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
          : {}),
      },
      include: projectInclude,
    })

    emitChanges(['projects'])
    return projectDto(updated, 0, PROJECT_PALETTE)
  })

  app.delete('/api/projects/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return
    const { id } = req.params as { id: string }
    await prisma.project.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['projects', 'tasks'])
    return { ok: true }
  })

  /* ── Вехи ─────────────────────────────────────────────────────────── */

  app.post('/api/projects/:id/milestones', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      title: z.string().trim().min(2, 'Укажите название вехи'),
      note: z.string().default(''),
      date: z.string(),
      state: z.enum(['planned', 'active', 'done']).default('planned'),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const created = await prisma.milestone.create({
      data: {
        projectId: id,
        title: parsed.data.title,
        note: parsed.data.note,
        date: new Date(parsed.data.date),
        state: parsed.data.state,
      },
    })
    emitChanges(['projects'])
    return reply.code(201).send(milestoneDto(created, longDate))
  })

  app.patch('/api/milestones/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      title: z.string().trim().min(2).optional(),
      note: z.string().optional(),
      date: z.string().optional(),
      state: z.enum(['planned', 'active', 'done']).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const updated = await prisma.milestone.update({
      where: { id },
      data: {
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
        ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}),
        ...(parsed.data.state ? { state: parsed.data.state } : {}),
      },
    })
    emitChanges(['projects'])
    return milestoneDto(updated, longDate)
  })

  app.delete('/api/milestones/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'sprint.manage'))) return
    const { id } = req.params as { id: string }
    await prisma.milestone.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['projects'])
    return { ok: true }
  })
}
