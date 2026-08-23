/** Канбан-доска: колонки, карточки и перетаскивание. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, require as requirePerm } from '../lib/auth.js'
import { taskDto, taskInclude } from '../lib/dto.js'
import { record, notify, taskAudience } from '../lib/activity.js'
import { emitChanges } from '../lib/events.js'
import { runRules } from '../lib/automation.js'

function parseStatuses(raw: string): string[] {
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

export async function boardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  /**
   * Доска целиком. Колонка карточки определяется её статусом, поэтому
   * доска и таблица задач никогда не расходятся.
   */
  app.get('/api/board', async (req) => {
    const query = z.object({
      queue: z.string().optional(),
      sprint: z.string().optional(),
      assignee: z.string().optional(),
      /** Сколько дней закрытых задач держать на доске. */
      doneDays: z.coerce.number().int().min(1).max(365).default(14),
    })
    const p = query.parse(req.query)

    const doneSince = new Date()
    doneSince.setDate(doneSince.getDate() - p.doneDays)

    const columns = await prisma.boardColumn.findMany({ orderBy: { order: 'asc' } })
    const tasks = await prisma.task.findMany({
      where: {
        ...(p.queue ? { queue: { key: { in: p.queue.split(',') } } } : {}),
        ...(p.sprint ? { sprint: { name: p.sprint } } : {}),
        ...(p.assignee ? { assignee: { code: { in: p.assignee.split(',') } } } : {}),
        // Архив закрытых задач остаётся в таблице, а доска показывает работу.
        OR: [
          { status: { category: { not: 'done' } } },
          { closedAt: { gte: doneSince } },
        ],
      },
      include: taskInclude,
      orderBy: [{ rank: 'asc' }, { num: 'desc' }],
    })

    const now = new Date()
    const byColumn = new Map<string, ReturnType<typeof taskDto>[]>()
    for (const c of columns) byColumn.set(c.name, [])

    // Статус, не попавший ни в одну колонку (например Blocked), показывается
    // в колонке «В работе», иначе карточка пропала бы с доски.
    const fallback = columns.find((c) => parseStatuses(c.statuses).includes('In Progress'))

    for (const task of tasks) {
      const column =
        columns.find((c) => parseStatuses(c.statuses).includes(task.status.name)) ?? fallback
      if (column) byColumn.get(column.name)!.push(taskDto(task, now))
    }

    return {
      columns: columns.map((c) => ({
        id: c.id,
        name: c.name,
        statuses: parseStatuses(c.statuses),
        wipLimit: c.wipLimit,
        keys: byColumn.get(c.name)!.map((t) => t.key),
      })),
      tasks: Object.fromEntries(
        [...byColumn.values()].flat().map((t) => [t.key, t]),
      ),
    }
  })

  /** Перенос карточки: меняет статус на первый статус колонки и позицию. */
  app.patch('/api/board/move', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'task.status'))) return

    const schema = z.object({
      key: z.string(),
      column: z.string(),
      index: z.number().int().min(0).nullable().default(null),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const task = await prisma.task.findUnique({
      where: { key: parsed.data.key.toUpperCase() },
      include: { status: true, queue: { select: { workflowId: true } } },
    })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const column = await prisma.boardColumn.findUnique({ where: { name: parsed.data.column } })
    if (!column) return reply.code(404).send({ error: 'Колонка не найдена' })

    const columnStatuses = parseStatuses(column.statuses)
    const alreadyHere = columnStatuses.includes(task.status.name)

    let nextStatusId = task.statusId
    let nextStatusName = task.status.name
    let nextCategory = task.status.category

    if (!alreadyHere) {
      const target = await prisma.status.findFirst({
        where: { workflowId: task.queue.workflowId, name: { in: columnStatuses } },
        orderBy: { order: 'asc' },
      })
      if (!target) {
        return reply
          .code(422)
          .send({ error: 'В воркфлоу очереди нет статуса для этой колонки' })
      }

      const transition = await prisma.transition.findUnique({
        where: { fromId_toId: { fromId: task.statusId, toId: target.id } },
      })
      if (!transition) {
        return reply
          .code(422)
          .send({ error: `Переход ${task.status.name} → ${target.name} не разрешён воркфлоу` })
      }

      nextStatusId = target.id
      nextStatusName = target.name
      nextCategory = target.category
    }

    /* Позиция внутри колонки: ранг ставится между соседями. */
    const siblings = await prisma.task.findMany({
      where: {
        status: { name: { in: columnStatuses } },
        id: { not: task.id },
      },
      orderBy: { rank: 'asc' },
      select: { id: true, rank: true },
    })

    const at = parsed.data.index === null ? siblings.length : Math.min(parsed.data.index, siblings.length)
    const before = at > 0 ? siblings[at - 1]?.rank : undefined
    const after = siblings[at]?.rank

    let rank: number
    if (before === undefined && after === undefined) rank = 1000
    else if (before === undefined) rank = after! - 100
    else if (after === undefined) rank = before + 100
    else rank = (before + after) / 2

    await prisma.task.update({
      where: { id: task.id },
      data: {
        statusId: nextStatusId,
        rank,
        closedAt: nextCategory === 'done' ? (task.closedAt ?? new Date()) : null,
      },
    })

    if (!alreadyHere) {
      await record({
        taskId: task.id,
        actorId: req.user!.id,
        kind: 'status',
        note: 'перенёс(ла) карточку на доске',
        field: 'status',
        fromValue: task.status.name,
        toValue: nextStatusName,
      })
      await notify({
        userIds: await taskAudience(task.id),
        actorId: req.user!.id,
        taskId: task.id,
        kind: 'status',
        text: `${req.user!.name} перевёл(а) задачу в ${nextStatusName}`,
      })
      await runRules('status_changed', task.id)
      if (nextCategory === 'done') await runRules('task_closed', task.id)
    }

    emitChanges(['board', 'tasks', 'projects', 'sprints'], task.key)

    const full = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: taskInclude,
    })
    return { task: taskDto(full) }
  })

  /** Настройка колонок: лимит WIP и состав статусов. */
  app.patch('/api/board/columns/:id', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'workflow.manage'))) return

    const { id } = req.params as { id: string }
    const schema = z.object({
      wipLimit: z.number().int().min(0).max(99).optional(),
      statuses: z.array(z.string()).optional(),
      name: z.string().trim().min(1).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const column = await prisma.boardColumn.update({
      where: { id },
      data: {
        ...(parsed.data.wipLimit !== undefined ? { wipLimit: parsed.data.wipLimit } : {}),
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.statuses ? { statuses: JSON.stringify(parsed.data.statuses) } : {}),
      },
    })
    emitChanges(['board'])
    return { id: column.id, name: column.name, wipLimit: column.wipLimit }
  })
}
