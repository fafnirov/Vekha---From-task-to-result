/** Канбан-доска: колонки, карточки и перетаскивание. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { atLeast, authenticate, can, require as requirePerm, requireTaskView } from '../lib/auth.js'
import { taskDto, taskInclude } from '../lib/dto.js'
import { record, notify, taskAudience } from '../lib/activity.js'
import { emitChanges } from '../lib/events.js'
import { runRules } from '../lib/automation.js'
import { ROLE_LABEL, type Role } from '../lib/constants.js'
import { canSeeQueue, taskScope } from '../lib/access.js'

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
  app.addHook('preHandler', requireTaskView)

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
    const allStatuses = await prisma.status.findMany({ select: { name: true, category: true } })
    const tasks = await prisma.task.findMany({
      where: {
        ...taskScope(req.user!),
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

    /*
     * Статус, не попавший ни в одну колонку, показывается в колонке
     * «в работе», иначе карточка пропала бы с доски. Колонка ищется по
     * категории входящих в неё статусов, а не по своему имени: имена
     * колонок и статусов правятся в настройках, и привязка к строчке
     * ломалась при первом же переименовании.
     */
    const inProgressNames = new Set(
      allStatuses.filter((s) => s.category === 'inprogress').map((s) => s.name),
    )
    const fallback =
      columns.find((c) => parseStatuses(c.statuses).some((n) => inProgressNames.has(n))) ??
      columns[0]

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
      /** Причина закрытия — нужна при переносе в завершающую колонку. */
      resolution: z.string().nullable().optional(),
      /*
       * Фильтры доски приходят вместе с переносом: позицию нужно считать
       * по тому же набору карточек, который видит пользователь, иначе
       * индекс из отфильтрованного списка применится к полному.
       */
      queue: z.string().optional(),
      sprint: z.string().optional(),
      assignee: z.string().optional(),
      doneDays: z.coerce.number().int().min(1).max(365).default(14),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const task = await prisma.task.findUnique({
      where: { key: parsed.data.key.toUpperCase() },
      include: {
        status: true,
        queue: { select: { workflowId: true, access: true, ownerId: true } },
      },
    })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })
    if (!canSeeQueue(req.user!, task.queue)) {
      return reply.code(404).send({ error: 'Задача не найдена' })
    }

    const column = await prisma.boardColumn.findUnique({ where: { name: parsed.data.column } })
    if (!column) return reply.code(404).send({ error: 'Колонка не найдена' })

    const columnStatuses = parseStatuses(column.statuses)
    const alreadyHere = columnStatuses.includes(task.status.name)

    let resolutionId: string | null = null
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
          .send({ error: 'В схеме очереди нет статуса для этой колонки' })
      }

      const transition = await prisma.transition.findUnique({
        where: { fromId_toId: { fromId: task.statusId, toId: target.id } },
      })
      if (!transition) {
        return reply
          .code(422)
          .send({ error: `Переход ${task.status.name} → ${target.name} не разрешён схемой работы` })
      }
      // Та же проверка роли, что и на карточке задачи.
      if (
        !atLeast(req.user!.role, transition.role as Role) &&
        !(await can(req.user!.role, 'workflow.manage'))
      ) {
        return reply.code(403).send({
          error: `Переход ${task.status.name} → ${target.name} доступен роли «${ROLE_LABEL[transition.role as Role] ?? transition.role}» и выше`,
        })
      }

      // Та же проверка, что и на карточке: закрытие требует причины.
      if (target.category === 'done' && !task.resolutionId) {
        const picked = parsed.data.resolution
          ? await prisma.resolution.findFirst({
              where: { OR: [{ id: parsed.data.resolution }, { name: parsed.data.resolution }] },
            })
          : null

        if (!picked) {
          const options = await prisma.resolution.findMany({ orderBy: { order: 'asc' } })
          return reply.code(422).send({
            error: 'Укажите причину закрытия',
            resolutionRequired: true,
            resolutions: options.map((r) => ({ id: r.id, name: r.name, kind: r.kind })),
          })
        }
        resolutionId = picked.id
      }

      nextStatusId = target.id
      nextStatusName = target.name
      nextCategory = target.category
    }

    /* ── Позиция внутри колонки ──────────────────────────────────── */

    const moveSince = new Date()
    moveSince.setDate(moveSince.getDate() - parsed.data.doneDays)

    // Те же условия и тот же порядок, что и в GET /api/board.
    const column_ = await prisma.task.findMany({
      where: {
        status: { name: { in: columnStatuses } },
        ...(parsed.data.queue ? { queue: { key: { in: parsed.data.queue.split(',') } } } : {}),
        ...(parsed.data.sprint ? { sprint: { name: parsed.data.sprint } } : {}),
        ...(parsed.data.assignee
          ? { assignee: { code: { in: parsed.data.assignee.split(',') } } }
          : {}),
        OR: [{ status: { category: { not: 'done' } } }, { closedAt: { gte: moveSince } }],
      },
      orderBy: [{ rank: 'asc' }, { num: 'desc' }],
      select: { id: true, rank: true },
    })

    // Карточку исключаем уже после сортировки: индекс с клиента считался
    // по списку, в котором она ещё была, иначе перенос вниз в своей же
    // колонке промахивается на одну позицию.
    const others = column_.filter((t) => t.id !== task.id)

    const at =
      parsed.data.index === null
        ? others.length
        : Math.max(0, Math.min(parsed.data.index, others.length))
    const before = at > 0 ? others[at - 1]?.rank : undefined
    const after = others[at]?.rank

    let rank: number
    if (before === undefined && after === undefined) rank = 1000
    else if (before === undefined) rank = after! - 100
    else if (after === undefined) rank = before + 100
    else rank = (before + after) / 2

    /*
     * Промежутка между соседями может не остаться: у сидовых задач ранги
     * совпадают, а деление пополам за полсотни переносов упирается в
     * точность double. Тогда перенумеровываем колонку с шагом 1000 —
     * без этого карточка молча возвращалась бы на место.
     */
    const tooTight =
      before !== undefined && after !== undefined && Math.abs(after - before) < 1e-6

    if (tooTight) {
      const order = others.map((t) => t.id)
      order.splice(at, 0, task.id)
      await prisma.$transaction(
        order.map((id, i) =>
          prisma.task.update({ where: { id }, data: { rank: (i + 1) * 1000 } }),
        ),
      )
      rank = (at + 1) * 1000
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        statusId: nextStatusId,
        ...(resolutionId ? { resolutionId } : {}),
        // Переоткрытая задача теряет прежнюю причину закрытия.
        ...(nextCategory !== 'done' && task.resolutionId ? { resolutionId: null } : {}),
        rank,
        closedAt: nextCategory === 'done' ? (task.closedAt ?? new Date()) : null,
      },
    })

    if (!alreadyHere) {
      await record({
        taskId: task.id,
        actorId: req.user!.id,
        kind: 'status',
        note: `перенёс(ла) карточку в «${nextStatusName}»`,
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
