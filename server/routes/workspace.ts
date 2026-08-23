/** Организация, участники, очереди и команды. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, require as requirePerm } from '../lib/auth.js'
import { personDto, queueDto } from '../lib/dto.js'
import { emitChanges } from '../lib/events.js'
import { AVATAR_PALETTE, QUEUE_ACCESS, ROLES } from '../lib/constants.js'
import { initialsFrom } from '../lib/format.js'
import { queueScope } from '../lib/access.js'

const queueInclude = {
  owner: { select: { code: true } },
  workflow: { select: { id: true, name: true } },
  _count: { select: { tasks: true } },
} as const

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  /* ── Организация ──────────────────────────────────────────────────── */

  app.get('/api/org', async () => {
    const org = await prisma.organization.findFirst()
    return {
      name: org?.name ?? 'Организация',
      unit: org?.unit ?? '',
      mark: org?.mark ?? 'В',
      version: process.env.npm_package_version ?? '3.0',
    }
  })

  app.patch('/api/org', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      unit: z.string().trim().optional(),
      mark: z.string().trim().max(2).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const existing = await prisma.organization.findFirst()
    const org = existing
      ? await prisma.organization.update({ where: { id: existing.id }, data: parsed.data })
      : await prisma.organization.create({
          data: { name: parsed.data.name ?? 'Организация', ...parsed.data },
        })

    return { name: org.name, unit: org.unit, mark: org.mark }
  })

  /* ── Участники ────────────────────────────────────────────────────── */

  app.get('/api/people', async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
    return users.map(personDto)
  })

  /** Загрузка участника: открытые задачи, story points, просрочки. */
  app.get('/api/people/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const user = await prisma.user.findFirst({ where: { OR: [{ code }, { id: code }] } })
    if (!user) return reply.code(404).send({ error: 'Участник не найден' })

    const tasks = await prisma.task.findMany({
      where: { assigneeId: user.id },
      include: { status: { select: { category: true } } },
    })
    const now = new Date()

    return {
      ...personDto(user),
      stats: {
        total: tasks.length,
        open: tasks.filter((t) => t.status.category !== 'done').length,
        done: tasks.filter((t) => t.status.category === 'done').length,
        points: tasks
          .filter((t) => t.status.category !== 'done')
          .reduce((sum, t) => sum + (t.estimate ?? 0), 0),
        overdue: tasks.filter(
          (t) => t.dueDate && t.dueDate < now && t.status.category !== 'done',
        ).length,
      },
    }
  })

  app.patch('/api/people/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'people.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      role: z.enum(ROLES).optional(),
      jobTitle: z.string().trim().max(60).optional(),
      name: z.string().trim().min(2).optional(),
      active: z.boolean().optional(),
      palette: z.number().int().min(0).max(AVATAR_PALETTE.length - 1).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return reply.code(404).send({ error: 'Участник не найден' })

    // Последнего администратора нельзя разжаловать или отключить —
    // иначе организация останется без доступа к настройкам.
    const losingAdmin =
      target.role === 'admin' &&
      ((parsed.data.role && parsed.data.role !== 'admin') || parsed.data.active === false)
    if (losingAdmin) {
      const admins = await prisma.user.count({ where: { role: 'admin', active: true } })
      if (admins <= 1) {
        return reply.code(409).send({ error: 'В организации должен остаться хотя бы один админ' })
      }
    }

    const palette = parsed.data.palette !== undefined ? AVATAR_PALETTE[parsed.data.palette] : null

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.jobTitle !== undefined ? { jobTitle: parsed.data.jobTitle } : {}),
        ...(parsed.data.name
          ? { name: parsed.data.name, initials: initialsFrom(parsed.data.name) }
          : {}),
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        ...(palette ? { avatarBg: palette.bg, avatarFg: palette.fg } : {}),
      },
    })

    emitChanges(['people'])
    return personDto(user)
  })

  /* ── Очереди ──────────────────────────────────────────────────────── */

  app.get('/api/queues', async (req) => {
    const rows = await prisma.queue.findMany({
      where: queueScope(req.user!),
      include: queueInclude,
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(queueDto)
  })

  app.post('/api/queues', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const schema = z.object({
      key: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Ключ — от 2 до 10 латинских букв и цифр'),
      name: z.string().trim().min(2, 'Укажите название'),
      owner: z.string().trim().min(1, 'Выберите владельца'),
      workflow: z.string().trim().min(1, 'Выберите воркфлоу'),
      access: z.enum(QUEUE_ACCESS).default('team'),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }
    const body = parsed.data

    const exists = await prisma.queue.findUnique({ where: { key: body.key } })
    if (exists) return reply.code(409).send({ error: 'Очередь с таким ключом уже есть' })

    const [owner, workflow] = await Promise.all([
      prisma.user.findFirst({ where: { OR: [{ id: body.owner }, { code: body.owner }] } }),
      prisma.workflow.findFirst({ where: { OR: [{ id: body.workflow }, { name: body.workflow }] } }),
    ])
    if (!owner) return reply.code(400).send({ error: 'Владелец не найден' })
    if (!workflow) return reply.code(400).send({ error: 'Воркфлоу не найден' })

    const created = await prisma.queue.create({
      data: {
        key: body.key,
        name: body.name,
        ownerId: owner.id,
        workflowId: workflow.id,
        access: body.access,
      },
      include: queueInclude,
    })

    emitChanges(['queues'])
    return reply.code(201).send(queueDto(created))
  })

  app.patch('/api/queues/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      owner: z.string().optional(),
      workflow: z.string().optional(),
      access: z.enum(QUEUE_ACCESS).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const [owner, workflow] = await Promise.all([
      parsed.data.owner
        ? prisma.user.findFirst({ where: { OR: [{ id: parsed.data.owner }, { code: parsed.data.owner }] } })
        : null,
      parsed.data.workflow
        ? prisma.workflow.findFirst({
            where: { OR: [{ id: parsed.data.workflow }, { name: parsed.data.workflow }] },
          })
        : null,
    ])

    const updated = await prisma.queue.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.access ? { access: parsed.data.access } : {}),
        ...(owner ? { ownerId: owner.id } : {}),
        ...(workflow ? { workflowId: workflow.id } : {}),
      },
      include: queueInclude,
    })

    emitChanges(['queues', 'tasks'])
    return queueDto(updated)
  })

  app.delete('/api/queues/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const count = await prisma.task.count({ where: { queueId: id } })
    if (count > 0) {
      return reply
        .code(409)
        .send({ error: `В очереди ${count} задач — сначала перенесите или удалите их` })
    }
    await prisma.queue.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['queues'])
    return { ok: true }
  })

  /* ── Команды ──────────────────────────────────────────────────────── */

  app.get('/api/teams', async () => {
    const teams = await prisma.team.findMany({
      include: {
        members: { include: { user: true } },
      },
      orderBy: { name: 'asc' },
    })

    const openTasks = await prisma.task.groupBy({
      by: ['assigneeId'],
      where: { status: { category: { not: 'done' } } },
      _count: { _all: true },
    })
    const load = new Map(openTasks.map((r) => [r.assigneeId, r._count._all]))

    return teams.map((team) => {
      const members = team.members.map((m) => ({
        ...personDto(m.user),
        teamRole: m.role,
        tasks: load.get(m.user.id) ?? 0,
      }))
      const tasks = members.reduce((sum, m) => sum + m.tasks, 0)
      // Ориентир загрузки — восемь открытых задач на человека.
      const capacity = members.length * 8
      return {
        id: team.id,
        name: team.name,
        abbr: team.abbr,
        note: team.note,
        bg: team.bg,
        fg: team.fg,
        members,
        tasks,
        load: capacity ? `${Math.round((tasks / capacity) * 100)}%` : '0%',
      }
    })
  })

  app.post('/api/teams', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'people.manage'))) return

    const schema = z.object({
      name: z.string().trim().min(2, 'Укажите название команды'),
      abbr: z.string().trim().max(3).optional(),
      note: z.string().default(''),
      members: z.array(z.string()).default([]),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const exists = await prisma.team.findUnique({ where: { name: parsed.data.name } })
    if (exists) return reply.code(409).send({ error: 'Команда с таким названием уже есть' })

    const count = await prisma.team.count()
    const palette = AVATAR_PALETTE[count % AVATAR_PALETTE.length]

    const team = await prisma.team.create({
      data: {
        name: parsed.data.name,
        abbr: parsed.data.abbr || initialsFrom(parsed.data.name),
        note: parsed.data.note,
        bg: palette.bg,
        fg: palette.fg,
      },
    })

    for (const ref of parsed.data.members) {
      const user = await prisma.user.findFirst({ where: { OR: [{ id: ref }, { code: ref }] } })
      if (user) {
        await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id } })
      }
    }

    emitChanges(['teams'])
    return reply.code(201).send({ id: team.id, name: team.name })
  })

  app.patch('/api/teams/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'people.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      abbr: z.string().trim().max(3).optional(),
      note: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    await prisma.team.update({ where: { id }, data: parsed.data })
    emitChanges(['teams'])
    return { ok: true }
  })

  app.post('/api/teams/:id/members', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'people.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({ user: z.string(), role: z.string().default('member') })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Укажите участника' })

    const user = await prisma.user.findFirst({
      where: { OR: [{ id: parsed.data.user }, { code: parsed.data.user }] },
    })
    if (!user) return reply.code(404).send({ error: 'Участник не найден' })

    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: id, userId: user.id } },
      create: { teamId: id, userId: user.id, role: parsed.data.role },
      update: { role: parsed.data.role },
    })

    emitChanges(['teams'])
    return { ok: true }
  })

  app.delete('/api/teams/:id/members/:user', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'people.manage'))) return

    const { id, user } = req.params as { id: string; user: string }
    const target = await prisma.user.findFirst({ where: { OR: [{ id: user }, { code: user }] } })
    if (!target) return reply.code(404).send({ error: 'Участник не найден' })

    await prisma.teamMember
      .delete({ where: { teamId_userId: { teamId: id, userId: target.id } } })
      .catch(() => undefined)

    emitChanges(['teams'])
    return { ok: true }
  })

  app.delete('/api/teams/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'people.manage'))) return
    const { id } = req.params as { id: string }
    await prisma.team.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['teams'])
    return { ok: true }
  })

  /* ── Теги ─────────────────────────────────────────────────────────── */

  app.get('/api/tags', async () => {
    const tags = await prisma.tag.findMany({
      include: { _count: { select: { tasks: true } } },
      orderBy: { name: 'asc' },
    })
    return tags.map((t) => ({ name: t.name, n: t._count.tasks }))
  })
}
