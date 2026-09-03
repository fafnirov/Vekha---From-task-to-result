/** Настройки: воркфлоу, поля задачи, права ролей, автоматизации, шаблоны. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ENFORCEABLE_FIELDS } from '../lib/fields.js'
import { prisma } from '../lib/prisma.js'
import { authenticate, require as requirePerm } from '../lib/auth.js'
import { emitChanges } from '../lib/events.js'
import {
  CATEGORY_COLOR,
  PERMISSION_KEYS,
  ROLES,
  ROLE_LABEL,
  STATUS_CATEGORIES,
} from '../lib/constants.js'
import { relativeTime } from '../lib/format.js'

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const value = JSON.parse(raw)
    return value === null || value === undefined ? fallback : (value as T)
  } catch {
    return fallback
  }
}

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  /* ── Воркфлоу и статусы ───────────────────────────────────────────── */

  app.get('/api/workflows', async () => {
    const workflows = await prisma.workflow.findMany({
      include: {
        statuses: { orderBy: { order: 'asc' } },
        transitions: { include: { from: true, to: true } },
        _count: { select: { queues: true } },
      },
      orderBy: { name: 'asc' },
    })

    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      queues: w._count.queues,
      statuses: w.statuses.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        order: s.order,
        color: CATEGORY_COLOR[s.category] ?? 'var(--tx3)',
      })),
      transitions: w.transitions.map((t) => ({
        id: t.id,
        from: t.from.name,
        to: t.to.name,
        fromId: t.fromId,
        toId: t.toId,
        cond: t.condition,
        role: ROLE_LABEL[t.role as keyof typeof ROLE_LABEL] ?? t.role,
        roleKey: t.role,
      })),
    }))
  })

  app.post('/api/workflows/:id/statuses', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().trim().min(2, 'Укажите название статуса'),
      category: z.enum(STATUS_CATEGORIES).default('todo'),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const exists = await prisma.status.findUnique({
      where: { workflowId_name: { workflowId: id, name: parsed.data.name } },
    })
    if (exists) return reply.code(409).send({ error: 'Такой статус уже есть' })

    const last = await prisma.status.findFirst({
      where: { workflowId: id },
      orderBy: { order: 'desc' },
    })

    const status = await prisma.status.create({
      data: {
        workflowId: id,
        name: parsed.data.name,
        category: parsed.data.category,
        order: (last?.order ?? 0) + 1,
      },
    })

    emitChanges(['workflow'])
    return reply.code(201).send({ id: status.id, name: status.name, category: status.category })
  })

  app.patch('/api/statuses/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      category: z.enum(STATUS_CATEGORIES).optional(),
      order: z.number().int().min(0).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const status = await prisma.status.update({ where: { id }, data: parsed.data })
    emitChanges(['workflow', 'tasks', 'board'])
    return { id: status.id, name: status.name, category: status.category }
  })

  app.delete('/api/statuses/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const used = await prisma.task.count({ where: { statusId: id } })
    if (used > 0) {
      return reply.code(409).send({ error: `Статус используют ${used} задач` })
    }
    await prisma.status.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['workflow'])
    return { ok: true }
  })

  app.post('/api/workflows/:id/transitions', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      from: z.string(),
      to: z.string(),
      condition: z.string().default(''),
      role: z.enum(ROLES).default('member'),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Укажите статусы перехода' })

    const [from, to] = await Promise.all([
      prisma.status.findFirst({ where: { workflowId: id, OR: [{ id: parsed.data.from }, { name: parsed.data.from }] } }),
      prisma.status.findFirst({ where: { workflowId: id, OR: [{ id: parsed.data.to }, { name: parsed.data.to }] } }),
    ])
    if (!from || !to) return reply.code(400).send({ error: 'Статус не найден в этой схеме' })
    if (from.id === to.id) return reply.code(400).send({ error: 'Переход в тот же статус' })

    await prisma.transition.upsert({
      where: { fromId_toId: { fromId: from.id, toId: to.id } },
      create: {
        workflowId: id,
        fromId: from.id,
        toId: to.id,
        condition: parsed.data.condition,
        role: parsed.data.role,
      },
      update: { condition: parsed.data.condition, role: parsed.data.role },
    })

    emitChanges(['workflow'])
    return reply.code(201).send({ ok: true })
  })

  app.delete('/api/transitions/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return
    const { id } = req.params as { id: string }
    await prisma.transition.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['workflow'])
    return { ok: true }
  })

  /* ── Типы задач и резолюции ───────────────────────────────────────── */

  app.get('/api/task-types', async () => {
    const types = await prisma.taskType.findMany({
      include: { _count: { select: { tasks: true } } },
      orderBy: { order: 'asc' },
    })
    return types.map((t) => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      color: t.color,
      epic: t.epic,
      system: t.system,
      n: t._count.tasks,
    }))
  })

  app.post('/api/task-types', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const schema = z.object({
      name: z.string().trim().min(2, 'Укажите название типа'),
      icon: z.string().default('task_alt'),
      color: z.string().default('var(--tx2)'),
      epic: z.boolean().default(false),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const exists = await prisma.taskType.findUnique({ where: { name: parsed.data.name } })
    if (exists) return reply.code(409).send({ error: 'Такой тип уже есть' })

    const last = await prisma.taskType.findFirst({ orderBy: { order: 'desc' } })
    const type = await prisma.taskType.create({
      data: { ...parsed.data, order: (last?.order ?? -1) + 1 },
    })

    emitChanges(['workflow'])
    return reply.code(201).send({ id: type.id })
  })

  app.patch('/api/task-types/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      epic: z.boolean().optional(),
      order: z.number().int().min(0).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    await prisma.taskType.update({ where: { id }, data: parsed.data })
    emitChanges(['workflow', 'tasks'])
    return { ok: true }
  })

  app.delete('/api/task-types/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const used = await prisma.task.count({ where: { typeId: id } })
    if (used > 0) return reply.code(409).send({ error: `Тип используют ${used} задач` })

    await prisma.taskType.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['workflow'])
    return { ok: true }
  })

  app.get('/api/resolutions', async () => {
    const rows = await prisma.resolution.findMany({
      include: { _count: { select: { tasks: true } } },
      orderBy: { order: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      system: r.system,
      n: r._count.tasks,
    }))
  })

  app.post('/api/resolutions', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const schema = z.object({
      name: z.string().trim().min(2, 'Укажите название резолюции'),
      kind: z.enum(['success', 'neutral', 'rejected']).default('neutral'),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const exists = await prisma.resolution.findUnique({ where: { name: parsed.data.name } })
    if (exists) return reply.code(409).send({ error: 'Такая резолюция уже есть' })

    const last = await prisma.resolution.findFirst({ orderBy: { order: 'desc' } })
    const created = await prisma.resolution.create({
      data: { ...parsed.data, order: (last?.order ?? -1) + 1 },
    })

    emitChanges(['workflow'])
    return reply.code(201).send({ id: created.id })
  })

  app.delete('/api/resolutions/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const used = await prisma.task.count({ where: { resolutionId: id } })
    if (used > 0) return reply.code(409).send({ error: `Резолюцию используют ${used} задач` })

    await prisma.resolution.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['workflow'])
    return { ok: true }
  })

  /* ── Поля задачи ──────────────────────────────────────────────────── */

  app.get('/api/fields', async () => {
    const fields = await prisma.taskField.findMany({ orderBy: { order: 'asc' } })
    return fields.map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      icon: f.icon,
      screen: f.screen,
      req: f.required,
      card: f.onCard,
      system: f.system,
    }))
  })

  app.patch('/api/fields/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      required: z.boolean().optional(),
      onCard: z.boolean().optional(),
      label: z.string().trim().min(2).optional(),
      screen: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const field = await prisma.taskField.findUnique({ where: { id } })
    if (!field) return reply.code(404).send({ error: 'Поле не найдено' })

    // У заголовка нельзя снять обязательность — без него задача не имеет смысла.
    if (field.key === 'title' && parsed.data.required === false) {
      return reply.code(409).send({ error: 'Заголовок всегда обязателен' })
    }

    // Обязательным делается только то, что сервер умеет проверить.
    // Молча принять тумблер и ничего не требовать — хуже, чем отказать.
    if (parsed.data.required === true && !(ENFORCEABLE_FIELDS as readonly string[]).includes(field.key)) {
      return reply
        .code(409)
        .send({ error: `Поле «${field.label}» нельзя сделать обязательным` })
    }

    const updated = await prisma.taskField.update({ where: { id }, data: parsed.data })
    emitChanges(['workflow'])
    return { id: updated.id, req: updated.required, card: updated.onCard }
  })

  /* ── Права ────────────────────────────────────────────────────────── */

  app.get('/api/permissions', async () => {
    const rows = await prisma.rolePermission.findMany()
    const byKey = new Map<string, Map<string, boolean>>()
    for (const r of rows) {
      if (!byKey.has(r.key)) byKey.set(r.key, new Map())
      byKey.get(r.key)!.set(r.role, r.allowed)
    }

    return {
      roles: ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r] })),
      rows: PERMISSION_KEYS.map((p) => ({
        id: p.key,
        label: p.label,
        cells: ROLES.map((role) => byKey.get(p.key)?.get(role) ?? false),
      })),
    }
  })

  app.patch('/api/permissions', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const schema = z.object({
      key: z.string(),
      role: z.enum(ROLES),
      allowed: z.boolean(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })
    const { key, role, allowed } = parsed.data

    const known = PERMISSION_KEYS.some((p) => p.key === key)
    if (!known) return reply.code(400).send({ error: 'Неизвестное право' })

    // Админ не может отобрать права у самого себя — это заблокировало бы
    // настройки навсегда.
    if (role === 'admin' && !allowed) {
      return reply.code(409).send({ error: 'У администратора нельзя снять права' })
    }

    await prisma.rolePermission.upsert({
      where: { key_role: { key, role } },
      create: { key, role, allowed },
      update: { allowed },
    })

    emitChanges(['workflow'])
    return { ok: true }
  })

  /* ── Автоматизации ────────────────────────────────────────────────── */

  app.get('/api/rules', async () => {
    const rules = await prisma.automationRule.findMany({
      include: { queue: { select: { key: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const now = new Date()
    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      trigger: r.trigger,
      triggerLabel: TRIGGER_LABEL[r.trigger] ?? r.trigger,
      cond: describeCondition(r.condition),
      action: describeActions(r.action),
      condition: parseJson(r.condition, {}),
      actions: parseJson<{ actions: unknown[] }>(r.action, { actions: [] }).actions,
      queue: r.queue?.key ?? null,
      icon: r.icon,
      iconFg: r.iconFg,
      on: r.enabled,
      runs: `${r.runCount} ${plural(r.runCount)}`,
      runCount: r.runCount,
      lastRun: r.lastRunAt ? relativeTime(r.lastRunAt, now) : null,
    }))
  })

  app.post('/api/rules', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const schema = z.object({
      name: z.string().trim().min(3, 'Укажите название правила'),
      trigger: z.enum(['task_created', 'status_changed', 'task_closed', 'schedule']),
      queue: z.string().nullable().default(null),
      condition: z.record(z.string(), z.unknown()).default({}),
      actions: z.array(z.record(z.string(), z.unknown())).default([]),
      icon: z.string().default('bolt'),
      iconFg: z.string().default('var(--ac)'),
      enabled: z.boolean().default(true),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }
    const body = parsed.data

    const queue = body.queue
      ? await prisma.queue.findFirst({
          where: { OR: [{ id: body.queue }, { key: body.queue.toUpperCase() }] },
        })
      : null

    const rule = await prisma.automationRule.create({
      data: {
        name: body.name,
        trigger: body.trigger,
        queueId: queue?.id ?? null,
        condition: JSON.stringify(body.condition),
        action: JSON.stringify({ actions: body.actions }),
        icon: body.icon,
        iconFg: body.iconFg,
        enabled: body.enabled,
      },
    })

    emitChanges(['workflow'])
    return reply.code(201).send({ id: rule.id })
  })

  app.patch('/api/rules/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().trim().min(3).optional(),
      enabled: z.boolean().optional(),
      trigger: z.enum(['task_created', 'status_changed', 'task_closed', 'schedule']).optional(),
      condition: z.record(z.string(), z.unknown()).optional(),
      actions: z.array(z.record(z.string(), z.unknown())).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const rule = await prisma.automationRule.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
        ...(parsed.data.trigger ? { trigger: parsed.data.trigger } : {}),
        ...(parsed.data.condition ? { condition: JSON.stringify(parsed.data.condition) } : {}),
        ...(parsed.data.actions ? { action: JSON.stringify({ actions: parsed.data.actions }) } : {}),
      },
    })

    emitChanges(['workflow'])
    return { id: rule.id, on: rule.enabled }
  })

  app.delete('/api/rules/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return
    const { id } = req.params as { id: string }
    await prisma.automationRule.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['workflow'])
    return { ok: true }
  })

  /* ── Шаблоны задач ────────────────────────────────────────────────── */

  app.get('/api/templates', async () => {
    const templates = await prisma.taskTemplate.findMany({
      include: { queue: { select: { key: true } } },
      orderBy: { name: 'asc' },
    })
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      note: t.note,
      body: t.body,
      queue: t.queue?.key ?? null,
      tags: parseJson<string[]>(t.tags, []),
    }))
  })

  app.post('/api/templates', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const schema = z.object({
      name: z.string().trim().min(2, 'Укажите название шаблона'),
      icon: z.string().default('description'),
      note: z.string().default(''),
      body: z.string().default(''),
      tags: z.array(z.string()).default([]),
      queue: z.string().nullable().default(null),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const queue = parsed.data.queue
      ? await prisma.queue.findFirst({
          where: { OR: [{ id: parsed.data.queue }, { key: parsed.data.queue.toUpperCase() }] },
        })
      : null

    const created = await prisma.taskTemplate.create({
      data: {
        name: parsed.data.name,
        icon: parsed.data.icon,
        note: parsed.data.note,
        body: parsed.data.body,
        tags: JSON.stringify(parsed.data.tags),
        queueId: queue?.id ?? null,
      },
    })

    emitChanges(['workflow'])
    return reply.code(201).send({ id: created.id })
  })

  app.delete('/api/templates/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return
    const { id } = req.params as { id: string }
    await prisma.taskTemplate.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['workflow'])
    return { ok: true }
  })
}

/* ── Человеческие подписи для правил ────────────────────────────────── */

const TRIGGER_LABEL: Record<string, string> = {
  task_created: 'Создание задачи',
  status_changed: 'Смена статуса',
  task_closed: 'Задача закрыта',
  schedule: 'Ежедневно 09:00',
}

const FIELD_LABEL: Record<string, string> = {
  status: 'статус',
  category: 'категория',
  priority: 'приоритет',
  queue: 'очередь',
  project: 'проект',
  assignee: 'исполнитель',
  tags: 'метка',
  overdue: 'срок просрочен',
  subtasksAllDone: 'все подзадачи закрыты',
  estimate: 'оценка',
}

interface Clause {
  field: string
  op: string
  value: unknown
}

function describeCondition(raw: string): string {
  const parsed = parseJson<{ all?: Clause[]; any?: Clause[] }>(raw, {})
  const clauses = [...(parsed.all ?? []), ...(parsed.any ?? [])]
  if (clauses.length === 0) return 'без условий'

  return clauses
    .map((c) => {
      const label = FIELD_LABEL[c.field] ?? c.field
      if (c.field === 'overdue' || c.field === 'subtasksAllDone') return label
      const value = Array.isArray(c.value) ? c.value.join(', ') : String(c.value)
      const op = c.op === 'neq' ? '≠' : c.op === 'in' ? 'из' : c.op === 'contains' ? '∋' : '='
      return `${label} ${op} ${value}`
    })
    .join(parsed.any?.length ? ' или ' : ' и ')
}

/** Кому адресовано уведомление — человеческими словами. */
const AUDIENCE_LABEL: Record<string, string> = {
  admin: 'администраторов',
  manager: 'лидов',
  member: 'участников',
  viewer: 'гостей',
  assignee: 'исполнителя',
  author: 'автора',
  watchers: 'наблюдателей',
}

const ACTION_LABEL: Record<string, (value?: string, role?: string) => string> = {
  notify: (value, role) =>
    role ? `Уведомить ${AUDIENCE_LABEL[role] ?? role}` : (value ?? 'Уведомить'),
  set_priority: (value) => `Приоритет → ${value ?? 'Высокий'}`,
  raise_priority: (value) => `Приоритет ↑ до ${value ?? 'Высокий'}`,
  set_status: (value) => `Статус → ${value ?? 'Готово'}`,
  set_assignee: (value) => `Исполнитель → ${value ?? '—'}`,
  add_comment: () => 'Добавить комментарий',
  add_watcher: (value) => `Наблюдатель → ${value ?? '—'}`,
  add_tag: (value) => `Метка → ${value ?? '—'}`,
}

function describeActions(raw: string): string {
  const parsed = parseJson<{ actions: { type: string; value?: string; role?: string }[] }>(raw, {
    actions: [],
  })
  const actions = parsed.actions ?? []
  if (actions.length === 0) return 'нет действий'
  return actions
    .map((a) => ACTION_LABEL[a.type]?.(a.value, a.role) ?? a.type)
    .join(' + ')
}

function plural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'запуск'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'запуска'
  return 'запусков'
}
