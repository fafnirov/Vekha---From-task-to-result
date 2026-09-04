/** Задачи: список, карточка, изменения, комментарии, связи, вложения. */

import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, stat, unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { atLeast, authenticate, can, canEditTask, require as requirePerm, requireTaskView } from '../lib/auth.js'
import { missingRequired, missingRequiredError, type FieldValues } from '../lib/fields.js'
import { commentDto, historyDto, taskDto, taskInclude, linkLabel } from '../lib/dto.js'
import { findMentions, notify, record, taskAudience, watch } from '../lib/activity.js'
import { emitChanges } from '../lib/events.js'
import { runRules } from '../lib/automation.js'
import { parseQuery, QueryError } from '../lib/query.js'
import {
  PRIORITIES,
  PRIORITY_LABEL,
  LINK_TYPES,
  ROLE_LABEL,
  type Priority,
  type Role,
} from '../lib/constants.js'
import { BASE_PATH, UPLOAD_DIR } from '../lib/paths.js'
import { formatMinutes, shortDate } from '../lib/format.js'
import { projectScope, taskScope, canSeeTask, visibleTask } from '../lib/access.js'

/** Поля, по которым таблица задач умеет сортироваться. */
const SORTABLE: Record<string, (dir: 'asc' | 'desc') => Prisma.TaskOrderByWithRelationInput> = {
  key: (dir) => ({ key: dir }),
  title: (dir) => ({ title: dir }),
  status: (dir) => ({ status: { order: dir } }),
  priority: (dir) => ({ priority: dir }),
  who: (dir) => ({ assignee: { name: dir } }),
  project: (dir) => ({ project: { name: dir } }),
  sprint: (dir) => ({ sprint: { startDate: dir } }),
  due: (dir) => ({ dueDate: dir }),
  est: (dir) => ({ estimate: dir }),
  updated: (dir) => ({ updatedAt: dir }),
  created: (dir) => ({ createdAt: dir }),
}

const listQuery = z.object({
  q: z.string().optional(),
  queue: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  project: z.string().optional(),
  sprint: z.string().optional(),
  tag: z.string().optional(),
  type: z.string().optional(),
  resolution: z.string().optional(),
  search: z.string().optional(),
  mine: z.coerce.boolean().optional(),
  watching: z.coerce.boolean().optional(),
  overdue: z.coerce.boolean().optional(),
  unassigned: z.coerce.boolean().optional(),
  parent: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().default('key'),
  dir: z.enum(['asc', 'desc']).default('desc'),
})

const createBody = z.object({
  title: z.string().trim().min(3, 'Заголовок короче трёх символов'),
  queue: z.string().trim().min(1, 'Выберите очередь'),
  description: z.string().default(''),
  priority: z.enum(PRIORITIES).default('medium'),
  assignee: z.string().nullable().optional(),
  project: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  sprint: z.string().nullable().optional(),
  status: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  estimate: z.number().int().min(0).max(999).nullable().optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  parentKey: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
})

const patchBody = z.object({
  title: z.string().trim().min(3).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.string().nullable().optional(),
  project: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  sprint: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimate: z.number().int().min(0).max(999).nullable().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  type: z.string().nullable().optional(),
  /// Причина закрытия: обязательна при переходе в завершающий статус.
  resolution: z.string().nullable().optional(),
})

/** Тип задачи по имени или идентификатору. */
async function resolveType(ref: string | null | undefined) {
  if (!ref) return null
  return prisma.taskType.findFirst({ where: { OR: [{ id: ref }, { name: ref }] } })
}

async function resolveResolution(ref: string | null | undefined) {
  if (!ref) return null
  return prisma.resolution.findFirst({ where: { OR: [{ id: ref }, { name: ref }] } })
}

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Разрешает код, email или id в идентификатор пользователя. */
async function resolveUser(ref: string | null | undefined): Promise<string | null | undefined> {
  if (ref === undefined) return undefined
  if (ref === null || ref === '') return null
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: ref }, { code: ref }, { email: ref.toLowerCase() }] },
    select: { id: true },
  })
  return user?.id ?? null
}

async function syncTags(taskId: string, names: string[]): Promise<void> {
  const clean = [...new Set(names.map((t) => t.trim().toLowerCase()).filter(Boolean))]
  await prisma.taskTag.deleteMany({ where: { taskId } })
  for (const name of clean) {
    const tag = await prisma.tag.upsert({ where: { name }, create: { name }, update: {} })
    await prisma.taskTag.create({ data: { taskId, tagId: tag.id } })
  }
}

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', requireTaskView)

  /* ── Список ───────────────────────────────────────────────────────── */

  app.get('/api/tasks', async (req, reply) => {
    const parsed = listQuery.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные параметры' })
    const p = parsed.data

    // Закрытые и ограниченные очереди не должны попадать в выдачу.
    const filters: Prisma.TaskWhereInput[] = [taskScope(req.user!)]

    if (p.q) {
      try {
        filters.push(
          parseQuery(p.q, { userId: req.user!.id, userCode: req.user!.code }),
        )
      } catch (err) {
        const message = err instanceof QueryError ? err.message : 'Ошибка в запросе'
        return reply.code(400).send({ error: message })
      }
    }

    if (p.queue) filters.push({ queue: { key: { in: p.queue.split(',') } } })
    if (p.status) filters.push({ status: { name: { in: p.status.split(',') } } })
    if (p.category) filters.push({ status: { category: { in: p.category.split(',') } } })
    if (p.priority) filters.push({ priority: { in: p.priority.split(',') } })
    if (p.project) filters.push({ project: { name: { in: p.project.split(',') } } })
    if (p.sprint) filters.push({ sprint: { name: { in: p.sprint.split(',') } } })
    if (p.tag) filters.push({ tags: { some: { tag: { name: { in: p.tag.split(',') } } } } })
    if (p.assignee) filters.push({ assignee: { code: { in: p.assignee.split(',') } } })
    if (p.type) filters.push({ type: { name: { in: p.type.split(',') } } })
    if (p.resolution) filters.push({ resolution: { name: { in: p.resolution.split(',') } } })
    if (p.mine) filters.push({ assigneeId: req.user!.id })
    // Без исполнителя — значит ни человека, ни команды.
    if (p.unassigned) filters.push({ assigneeId: null, teamId: null })
    if (p.watching) filters.push({ watchers: { some: { userId: req.user!.id } } })
    if (p.parent) filters.push({ parent: { key: p.parent } })
    if (p.overdue) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      filters.push({ dueDate: { lt: today }, status: { category: { not: 'done' } } })
    }
    if (p.search) {
      filters.push({
        OR: [
          { title: { contains: p.search } },
          { key: { contains: p.search.toUpperCase() } },
          { description: { contains: p.search } },
        ],
      })
    }

    const where: Prisma.TaskWhereInput = filters.length ? { AND: filters } : {}
    // hasOwn, а не ??: `sort=constructor` иначе достанет функцию из
    // прототипа и запрос упадёт с 500.
    const orderFn = Object.hasOwn(SORTABLE, p.sort) ? SORTABLE[p.sort] : SORTABLE.key

    const [total, rows] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [orderFn(p.dir), { num: 'desc' }],
        skip: (p.page - 1) * p.perPage,
        take: p.perPage,
      }),
    ])

    const now = new Date()
    return {
      items: rows.map((t) => taskDto(t, now)),
      total,
      page: p.page,
      perPage: p.perPage,
      pages: Math.max(1, Math.ceil(total / p.perPage)),
    }
  })

  /* ── Карточка ─────────────────────────────────────────────────────── */

  app.get('/api/tasks/:key', async (req, reply) => {
    const { key } = req.params as { key: string }
    const task = await prisma.task.findUnique({
      where: { key: key.toUpperCase() },
      include: {
        ...taskInclude,
        queue: {
          select: {
            key: true,
            ownerId: true,
            teams: { select: { members: { select: { userId: true } } } },
          },
        },
        subtasks: { include: taskInclude, orderBy: { num: 'asc' } },
        watchers: { include: { user: { select: { id: true, code: true, name: true } } } },
        linksOut: { include: { to: { include: taskInclude } } },
        linksIn: { include: { from: { include: taskInclude } } },
        attachments: {
          include: { uploadedBy: { select: { code: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        worklogs: {
          include: { user: { select: { code: true, name: true } } },
          orderBy: { spentOn: 'desc' },
        },
      },
    })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })
    // Ответ «не найдена», а не «нет доступа»: иначе по коду ответа можно
    // проверять существование задач в закрытой очереди.
    if (!canSeeTask(req.user!, task)) {
      return reply.code(404).send({ error: 'Задача не найдена' })
    }

    const now = new Date()
    const availableTransitions = await prisma.transition.findMany({
      where: { fromId: task.statusId },
      include: { to: true },
    })

    return {
      task: taskDto(task, now),
      subtasks: task.subtasks.map((s) => taskDto(s, now)),
      watchers: task.watchers.map((w) => ({ id: w.user.id, code: w.user.code, name: w.user.name })),
      links: [
        ...task.linksOut.map((l) => ({
          id: l.id,
          type: l.type,
          label: linkLabel(l.type, false),
          direction: 'out' as const,
          task: taskDto(l.to, now),
        })),
        ...task.linksIn.map((l) => ({
          id: l.id,
          type: l.type,
          label: linkLabel(l.type, true),
          direction: 'in' as const,
          task: taskDto(l.from, now),
        })),
      ],
      attachments: task.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        size: a.size,
        mime: a.mime,
        by: a.uploadedBy.code,
        byName: a.uploadedBy.name,
        url: `${BASE_PATH}/api/attachments/${a.id}`,
        createdAt: a.createdAt.toISOString(),
      })),
      worklog: {
        total: task.worklogs.reduce((sum, w) => sum + w.minutes, 0),
        items: task.worklogs.map((w) => ({
          id: w.id,
          minutes: w.minutes,
          note: w.note,
          who: w.user.code,
          whoName: w.user.name,
          spentOn: w.spentOn.toISOString(),
          day: shortDate(w.spentOn),
        })),
      },
      transitions: availableTransitions.map((t) => ({
        id: t.id,
        to: t.to.name,
        category: t.to.category,
        condition: t.condition,
        role: t.role,
      })),
    }
  })

  /* ── Создание ─────────────────────────────────────────────────────── */

  app.post('/api/tasks', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'task.create'))) return

    const parsed = createBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }
    const body = parsed.data

    const queue = await prisma.queue.findFirst({
      where: { OR: [{ key: body.queue.toUpperCase() }, { id: body.queue }] },
      include: { workflow: { include: { statuses: { orderBy: { order: 'asc' } } } } },
    })
    if (!queue) return reply.code(400).send({ error: 'Очередь не найдена' })

    const status =
      queue.workflow.statuses.find((s) => s.name === body.status) ??
      queue.workflow.statuses[0]
    if (!status) return reply.code(400).send({ error: 'У схемы очереди нет статусов' })

    const assigneeId = (await resolveUser(body.assignee)) ?? null
    /* Привязать задачу можно только к проекту, который человеку открыт:
       иначе доступ обходился бы подстановкой чужого названия. */
    const project = body.project
      ? await prisma.project.findFirst({
          where: {
            AND: [{ OR: [{ id: body.project }, { name: body.project }] }, projectScope(req.user!)],
          },
          select: { id: true },
        })
      : null
    // Молча создать задачу без проекта значило бы потерять указание.
    if (body.project && !project) {
      return reply.code(400).send({ error: 'Проект не найден' })
    }
    const sprint = body.sprint
      ? await prisma.sprint.findFirst({
          where: { OR: [{ id: body.sprint }, { name: body.sprint, queueId: queue.id }] },
          select: { id: true },
        })
      : null
    const team = body.team
      ? await prisma.team.findFirst({
          where: { OR: [{ id: body.team }, { name: body.team }] },
          select: { id: true },
        })
      : null
    const parent = body.parentKey
      ? await prisma.task.findUnique({
          where: { key: body.parentKey.toUpperCase() },
          select: { id: true },
        })
      : null

    // Обязательные поля проверяются до выдачи номера: иначе счётчик
    // очереди израсходуется на попытку, которая не создаст задачу, и в
    // ключах появятся дыры.
    const gaps = await missingRequired({
      title: body.title,
      description: body.description,
      // Команда — тоже исполнитель, поле заполнено и в этом случае.
      assignee: team?.id ?? assigneeId,
      sprint: sprint?.id ?? null,
      estimate: body.estimate ?? null,
      dueDate: toDate(body.dueDate) ?? null,
    })
    if (gaps.length) return reply.code(422).send(missingRequiredError(gaps))

    // Номер выдаётся в транзакции, иначе два одновременных создания
    // получат один и тот же ключ.
    const num = await prisma.$transaction(async (tx) => {
      const updated = await tx.queue.update({
        where: { id: queue.id },
        data: { counter: { increment: 1 } },
        select: { counter: true },
      })
      return updated.counter
    })

    const type =
      (await resolveType(body.type)) ??
      (await prisma.taskType.findFirst({ orderBy: { order: 'asc' } }))

    const created = await prisma.task.create({
      data: {
        key: `${queue.key}-${num}`,
        num,
        queueId: queue.id,
        title: body.title,
        description: body.description,
        statusId: status.id,
        typeId: type?.id ?? null,
        priority: body.priority,
        /*
         * Исполнитель — либо человек, либо команда, но не оба сразу:
         * иначе непонятно, с кого спрашивать. Что указали последним, то
         * и берём; переданное вместе — трактуем в пользу команды, раз
         * её выбрали осознанно.
         */
        assigneeId: team ? null : assigneeId,
        authorId: req.user!.id,
        projectId: project?.id ?? null,
        teamId: team?.id ?? null,
        sprintId: sprint?.id ?? null,
        parentId: parent?.id ?? null,
        dueDate: toDate(body.dueDate) ?? null,
        estimate: body.estimate ?? null,
        rank: Date.now(),
      },
    })

    if (body.tags.length) await syncTags(created.id, body.tags)
    await watch(created.id, req.user!.id)
    if (assigneeId) await watch(created.id, assigneeId)

    await record({
      taskId: created.id,
      actorId: req.user!.id,
      kind: 'created',
      note: `создал(а) задачу в очереди ${queue.key}`,
    })

    if (assigneeId && assigneeId !== req.user!.id) {
      await notify({
        userIds: [assigneeId],
        actorId: req.user!.id,
        taskId: created.id,
        kind: 'assigned',
        text: `${req.user!.name} назначил(а) вас исполнителем`,
      })
    }

    await runRules('task_created', created.id)
    emitChanges(['tasks', 'board', 'queues', 'projects'], created.key)

    const full = await prisma.task.findUniqueOrThrow({
      where: { id: created.id },
      include: taskInclude,
    })
    return reply.code(201).send({ task: taskDto(full) })
  })

  /* ── Изменение ────────────────────────────────────────────────────── */

  app.patch('/api/tasks/:key', async (req, reply) => {
    const { key } = req.params as { key: string }
    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }
    const body = parsed.data

    const task = await prisma.task.findUnique({
      where: { key: key.toUpperCase() },
      include: {
        status: true,
        type: true,
        resolution: true,
        queue: { include: { workflow: true } },
        watchers: { select: { userId: true } },
        team: { select: { name: true, members: { select: { userId: true } } } },
        assignee: { select: { name: true } },
        project: { select: { name: true } },
        sprint: { select: { name: true } },
      },
    })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })
    if (!canSeeTask(req.user!, task)) {
      return reply.code(404).send({ error: 'Задача не найдена' })
    }

    if (!(await canEditTask(req.user!, task))) {
      return reply.code(403).send({ error: 'Можно править только свои задачи' })
    }

    /*
     * Права проверяются здесь, до любых изменений. Иначе отказ в середине
     * обработки оставлял бы следы: назначенный исполнитель уже получил бы
     * уведомление и подписку, а сама правка не применилась.
     */
    if (body.status !== undefined && body.status !== task.status.name) {
      if (!(await requirePerm(req, reply, 'task.status'))) return
    }
    if (body.sprint !== undefined) {
      if (!(await requirePerm(req, reply, 'sprint.manage'))) return
    }

    /*
     * Обязательные поля: очистить объявленное обязательным нельзя.
     * Проверка стоит до применения изменений — дальше по ходу обработки
     * уже уходят подписки и уведомления, и отказ после них оставил бы
     * следы правки, которой не было.
     *
     * Проверяются только поля, пришедшие в запросе: незаполненное
     * обязательное поле у старой задачи не должно мешать править
     * соседнее. Исполнитель и спринт разрешаются здесь повторно —
     * пустым считается то, что не нашлось, а не то, что не прислали.
     */
    const touched: FieldValues = {}
    if (body.title !== undefined) touched.title = body.title
    if (body.description !== undefined) touched.description = body.description
    if (body.dueDate !== undefined) touched.dueDate = toDate(body.dueDate) ?? null
    if (body.estimate !== undefined) touched.estimate = body.estimate ?? null
    if (body.assignee !== undefined) touched.assignee = await resolveUser(body.assignee)
    if (body.sprint !== undefined) {
      touched.sprint = body.sprint
        ? (
            await prisma.sprint.findFirst({
              where: { OR: [{ id: body.sprint }, { name: body.sprint, queueId: task.queueId }] },
              select: { id: true },
            })
          )?.id ?? null
        : null
    }

    const gaps = await missingRequired(touched)
    if (gaps.length) return reply.code(422).send(missingRequiredError(gaps))

    const data: Prisma.TaskUpdateInput = {}
    const events: { kind: string; note: string; from?: string; to?: string; field?: string }[] = []
    const actor = req.user!.name

    /* Статус — единственное изменение с проверкой воркфлоу. */
    if (body.status && body.status !== task.status.name) {
      const next = await prisma.status.findFirst({
        where: { workflowId: task.queue.workflowId, name: body.status },
      })
      if (!next) return reply.code(400).send({ error: 'Такого статуса нет в схеме очереди' })

      const transition = await prisma.transition.findUnique({
        where: { fromId_toId: { fromId: task.statusId, toId: next.id } },
      })
      if (!transition) {
        return reply
          .code(422)
          .send({ error: `Переход ${task.status.name} → ${next.name} не разрешён схемой работы` })
      }
      // Роль перехода из настроек воркфлоу: раньше она только отображалась.
      if (
        !atLeast(req.user!.role, transition.role as Role) &&
        !(await can(req.user!.role, 'workflow.manage'))
      ) {
        return reply.code(403).send({
          error: `Переход ${task.status.name} → ${next.name} доступен роли «${ROLE_LABEL[transition.role as Role] ?? transition.role}» и выше`,
        })
      }

      const closing = next.category === 'done'
      const wasClosed = task.status.category === 'done'

      if (closing) {
        // Без резолюции «Done» не отличает решённую задачу от отменённой,
        // и отчёты приписывают команде чужую заслугу.
        const picked = (await resolveResolution(body.resolution)) ?? null
        if (!picked && !task.resolutionId) {
          const options = await prisma.resolution.findMany({ orderBy: { order: 'asc' } })
          return reply.code(422).send({
            error: 'Укажите причину закрытия',
            resolutionRequired: true,
            resolutions: options.map((r) => ({ id: r.id, name: r.name, kind: r.kind })),
          })
        }
        if (picked) {
          data.resolution = { connect: { id: picked.id } }
          events.push({
            kind: 'resolution',
            field: 'resolution',
            note: 'указал(а) причину закрытия',
            to: picked.name,
          })
        }
      } else if (wasClosed && task.resolutionId) {
        // Задачу переоткрыли — прежняя причина закрытия больше не верна.
        data.resolution = { disconnect: true }
        events.push({
          kind: 'resolution',
          field: 'resolution',
          note: 'снял(а) причину закрытия',
          from: task.resolution?.name ?? '',
        })
      }

      data.status = { connect: { id: next.id } }
      data.closedAt = closing ? new Date() : null
      events.push({
        kind: 'status',
        field: 'status',
        note: 'изменил(а) статус',
        from: task.status.name,
        to: next.name,
      })
    }

    if (body.title !== undefined && body.title !== task.title) {
      data.title = body.title
      events.push({ kind: 'title', field: 'title', note: 'изменил(а) заголовок' })
    }

    if (body.description !== undefined && body.description !== task.description) {
      data.description = body.description
      events.push({ kind: 'description', field: 'description', note: 'обновил(а) описание' })
    }

    if (body.type !== undefined) {
      const nextType = await resolveType(body.type)
      if ((nextType?.id ?? null) !== task.typeId) {
        data.type = nextType ? { connect: { id: nextType.id } } : { disconnect: true }
        events.push({
          kind: 'type',
          field: 'type',
          note: 'изменил(а) тип задачи',
          from: task.type?.name ?? '—',
          to: nextType?.name ?? '—',
        })
      }
    }

    if (body.priority && body.priority !== task.priority) {
      data.priority = body.priority
      events.push({
        kind: 'priority',
        field: 'priority',
        note: 'изменил(а) приоритет',
        from: PRIORITY_LABEL[task.priority as Priority],
        to: PRIORITY_LABEL[body.priority],
      })
    }

    if (body.assignee !== undefined) {
      const nextId = await resolveUser(body.assignee)
      if (nextId !== task.assigneeId) {
        data.assignee = nextId ? { connect: { id: nextId } } : { disconnect: true }
        const nextUser = nextId
          ? await prisma.user.findUnique({ where: { id: nextId }, select: { name: true } })
          : null
        events.push({
          kind: 'assignee',
          field: 'assignee',
          note: 'сменил(а) исполнителя',
          from: task.assignee?.name ?? '—',
          to: nextUser?.name ?? '—',
        })
        if (nextId) {
          // Назначили человека — значит команда больше не исполнитель.
          if (task.teamId) data.team = { disconnect: true }
          await watch(task.id, nextId)
          await notify({
            userIds: [nextId],
            actorId: req.user!.id,
            taskId: task.id,
            kind: 'assigned',
            text: `${actor} назначил(а) вас исполнителем`,
          })
        }
      }
    }

    if (body.project !== undefined) {
      const project = body.project
        ? await prisma.project.findFirst({
            where: {
              AND: [{ OR: [{ id: body.project }, { name: body.project }] }, projectScope(req.user!)],
            },
            select: { id: true, name: true },
          })
        : null
      if (body.project && !project) {
        return reply.code(400).send({ error: 'Проект не найден' })
      }
      if ((project?.id ?? null) !== task.projectId) {
        data.project = project ? { connect: { id: project.id } } : { disconnect: true }
        events.push({
          kind: 'project',
          field: 'project',
          note: 'перенёс(ла) задачу в другой проект',
          from: task.project?.name ?? '—',
          to: project?.name ?? '—',
        })
      }
    }

    if (body.team !== undefined) {
      const team = body.team
        ? await prisma.team.findFirst({
            where: { OR: [{ id: body.team }, { name: body.team }] },
            select: { id: true, name: true },
          })
        : null
      if ((team?.id ?? null) !== task.teamId) {
        data.team = team ? { connect: { id: team.id } } : { disconnect: true }
        events.push({
          kind: 'assignee',
          field: 'team',
          note: 'сменил(а) исполнителя на команду',
          from: task.team?.name ?? task.assignee?.name ?? '—',
          to: team?.name ?? '—',
        })
        if (team) {
          // Исполнитель один: команда сменяет человека, а не дополняет.
          if (task.assigneeId) data.assignee = { disconnect: true }

          /*
           * Уведомляем всех, кому теперь принадлежит работа. Иначе
           * поручение команде осталось бы незамеченным: у команды нет
           * почтового ящика, а колокольчик есть у каждого её участника.
           */
          const members = await prisma.teamMember.findMany({
            where: { teamId: team.id },
            select: { userId: true },
          })
          const ids = members.map((m) => m.userId).filter((id) => id !== req.user!.id)
          for (const id of ids) await watch(task.id, id)
          if (ids.length) {
            await notify({
              userIds: ids,
              actorId: req.user!.id,
              taskId: task.id,
              kind: 'assigned',
              text: `${actor} поручил(а) задачу вашей команде «${team.name}»`,
            })
          }
        }
      }
    }

    if (body.sprint !== undefined) {
      const sprint = body.sprint
        ? await prisma.sprint.findFirst({
            where: { OR: [{ id: body.sprint }, { name: body.sprint, queueId: task.queueId }] },
            select: { id: true, name: true },
          })
        : null
      if ((sprint?.id ?? null) !== task.sprintId) {
        data.sprint = sprint ? { connect: { id: sprint.id } } : { disconnect: true }
        events.push({
          kind: 'sprint',
          field: 'sprint',
          note: 'изменил(а) спринт',
          from: task.sprint?.name ?? '—',
          to: sprint?.name ?? '—',
        })
      }
    }

    if (body.dueDate !== undefined) {
      const next = toDate(body.dueDate) ?? null
      const same = next?.getTime() === task.dueDate?.getTime()
      if (!same) {
        data.dueDate = next
        events.push({ kind: 'due', field: 'dueDate', note: 'изменил(а) срок' })
      }
    }

    if (body.estimate !== undefined && body.estimate !== task.estimate) {
      data.estimate = body.estimate
      events.push({
        kind: 'estimate',
        field: 'estimate',
        note: `установил(а) оценку ${body.estimate ?? 0}`,
      })
    }

    if (body.tags) {
      await syncTags(task.id, body.tags)
    }

    if (Object.keys(data).length === 0 && events.length === 0 && !body.tags) {
      const untouched = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
        include: taskInclude,
      })
      return { task: taskDto(untouched) }
    }

    await prisma.task.update({ where: { id: task.id }, data })

    for (const e of events) {
      await record({
        taskId: task.id,
        actorId: req.user!.id,
        kind: e.kind,
        note: e.note,
        field: e.field,
        fromValue: e.from ?? '',
        toValue: e.to ?? '',
      })
    }

    const statusEvent = events.find((e) => e.kind === 'status')
    if (statusEvent) {
      await notify({
        userIds: await taskAudience(task.id),
        actorId: req.user!.id,
        taskId: task.id,
        kind: 'status',
        text: `${actor} перевёл(а) задачу в ${statusEvent.to}`,
      })
      await runRules('status_changed', task.id)
      const nowStatus = await prisma.task.findUnique({
        where: { id: task.id },
        select: { status: { select: { category: true } } },
      })
      if (nowStatus?.status.category === 'done') await runRules('task_closed', task.id)
    }

    emitChanges(['tasks', 'board', 'projects', 'sprints'], task.key)

    const full = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: taskInclude,
    })
    return { task: taskDto(full) }
  })

  app.delete('/api/tasks/:key', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'task.delete'))) return
    const { key } = req.params as { key: string }
    const task = await prisma.task.findUnique({
      where: { key: key.toUpperCase() },
      include: {
        queue: {
          select: {
            ownerId: true,
            teams: { select: { members: { select: { userId: true } } } },
          },
        },
        watchers: { select: { userId: true } },
        team: { select: { members: { select: { userId: true } } } },
      },
    })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })
    if (!canSeeTask(req.user!, task)) {
      return reply.code(404).send({ error: 'Задача не найдена' })
    }
    await prisma.task.delete({ where: { id: task.id } })
    emitChanges(['tasks', 'board', 'queues', 'projects'])
    return { ok: true }
  })

  /** Массовые действия таблицы: статус, исполнитель, приоритет, спринт. */
  app.post('/api/tasks/bulk', async (req, reply) => {
    const schema = z.object({
      // Ограничение сверху: иначе один запрос выльется в тысячи правок
      // с автоматизациями и уведомлениями внутри.
      keys: z.array(z.string()).min(1).max(200),
      status: z.string().optional(),
      priority: z.enum(PRIORITIES).optional(),
      assignee: z.string().nullable().optional(),
      sprint: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Некорректные данные: не больше 200 задач за раз' })
    }

    let applied = 0
    const failed: { key: string; reason: string }[] = []

    for (const key of parsed.data.keys) {
      const res = await app.inject({
        method: 'PATCH',
        // Префикс обязателен: маршруты зарегистрированы под BASE_PATH,
        // и без него inject уходит в обработчик «не найдено».
        url: `${BASE_PATH}/api/tasks/${encodeURIComponent(key)}`,
        headers: { cookie: req.headers.cookie ?? '' },
        payload: {
          status: parsed.data.status,
          priority: parsed.data.priority,
          assignee: parsed.data.assignee,
          sprint: parsed.data.sprint,
        },
      })
      if (res.statusCode < 300) applied += 1
      else {
        // Ответ без JSON-тела не должен ронять весь массовый запрос.
        let reason = 'Не удалось изменить'
        try {
          reason = res.json<{ error?: string }>().error ?? reason
        } catch {
          reason = `Ошибка ${res.statusCode}`
        }
        failed.push({ key, reason })
      }
    }

    emitChanges(['tasks', 'board'])
    return { applied, failed }
  })

  /* ── Комментарии ──────────────────────────────────────────────────── */

  app.get('/api/tasks/:key/comments', async (req, reply) => {
    const { key } = req.params as { key: string }
    const task = await prisma.task.findFirst({ where: visibleTask(req.user!, key) })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const rows = await prisma.comment.findMany({
      where: { taskId: task.id },
      include: { author: { select: { code: true, name: true, jobTitle: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const now = new Date()
    return rows.map((c) => commentDto(c, now))
  })

  app.post('/api/tasks/:key/comments', async (req, reply) => {
    const { key } = req.params as { key: string }
    const schema = z.object({ text: z.string().trim().min(1, 'Комментарий пуст') })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const task = await prisma.task.findFirst({ where: visibleTask(req.user!, key) })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const comment = await prisma.comment.create({
      data: { taskId: task.id, authorId: req.user!.id, body: parsed.data.text },
      include: { author: { select: { code: true, name: true, jobTitle: true } } },
    })

    await watch(task.id, req.user!.id)
    await record({
      taskId: task.id,
      actorId: req.user!.id,
      kind: 'comment',
      note: `оставил(а) комментарий: «${parsed.data.text.slice(0, 60)}…»`,
    })

    const mentioned = await findMentions(parsed.data.text)
    if (mentioned.length) {
      await notify({
        userIds: mentioned,
        actorId: req.user!.id,
        taskId: task.id,
        kind: 'mention',
        text: `${req.user!.name} упомянул(а) вас в комментарии`,
      })
      for (const id of mentioned) await watch(task.id, id)
    }

    const others = (await taskAudience(task.id)).filter((id) => !mentioned.includes(id))
    await notify({
      userIds: others,
      actorId: req.user!.id,
      taskId: task.id,
      kind: 'comment',
      text: `${req.user!.name} прокомментировал(а) задачу`,
    })

    emitChanges(['comments', 'tasks'], task.key)
    return reply.code(201).send(commentDto(comment))
  })

  app.patch('/api/comments/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const schema = z.object({ text: z.string().trim().min(1) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Комментарий пуст' })

    const comment = await prisma.comment.findFirst({
      where: { id, task: taskScope(req.user!) },
    })
    if (!comment) return reply.code(404).send({ error: 'Комментарий не найден' })
    if (comment.authorId !== req.user!.id) {
      return reply.code(403).send({ error: 'Можно править только свои комментарии' })
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: { body: parsed.data.text, editedAt: new Date() },
      include: { author: { select: { code: true, name: true, jobTitle: true } } },
    })
    emitChanges(['comments'])
    return commentDto(updated)
  })

  app.delete('/api/comments/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const comment = await prisma.comment.findFirst({
      where: { id, task: taskScope(req.user!) },
    })
    if (!comment) return reply.code(404).send({ error: 'Комментарий не найден' })

    const mine = comment.authorId === req.user!.id
    if (!mine && !(await can(req.user!.role, 'task.editForeign'))) {
      return reply.code(403).send({ error: 'Недостаточно прав' })
    }
    await prisma.comment.delete({ where: { id } })
    emitChanges(['comments'])
    return { ok: true }
  })

  /* ── История ──────────────────────────────────────────────────────── */

  app.get('/api/tasks/:key/history', async (req, reply) => {
    const { key } = req.params as { key: string }
    const task = await prisma.task.findFirst({ where: visibleTask(req.user!, key) })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const rows = await prisma.activity.findMany({
      where: { taskId: task.id },
      include: {
        actor: { select: { name: true, code: true } },
        task: { select: { key: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const now = new Date()
    return rows.map((a) => historyDto(a, now))
  })

  /* ── Чек-лист ─────────────────────────────────────────────────────── */

  app.get('/api/tasks/:key/checklist', async (req, reply) => {
    const { key } = req.params as { key: string }
    const task = await prisma.task.findFirst({ where: visibleTask(req.user!, key) })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const items = await prisma.checklistItem.findMany({
      where: { taskId: task.id },
      include: { assignee: { select: { code: true, name: true } } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })

    return items.map((i) => ({
      id: i.id,
      text: i.text,
      done: i.done,
      who: i.assignee?.code ?? null,
      whoName: i.assignee?.name ?? null,
      due: shortDate(i.dueDate),
      dueDate: i.dueDate ? i.dueDate.toISOString() : null,
      spawnedKey: i.spawnedKey,
      order: i.order,
    }))
  })

  app.post('/api/tasks/:key/checklist', async (req, reply) => {
    const { key } = req.params as { key: string }
    const schema = z.object({
      text: z.string().trim().min(1, 'Пункт пуст').max(300),
      assignee: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const task = await prisma.task.findFirst({
      where: visibleTask(req.user!, key),
      select: { id: true, authorId: true, assigneeId: true },
    })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })
    if (!(await canEditTask(req.user!, task))) {
      return reply.code(403).send({ error: 'Можно править только свои задачи' })
    }

    const last = await prisma.checklistItem.findFirst({
      where: { taskId: task.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const item = await prisma.checklistItem.create({
      data: {
        taskId: task.id,
        text: parsed.data.text,
        assigneeId: (await resolveUser(parsed.data.assignee)) ?? null,
        dueDate: toDate(parsed.data.dueDate) ?? null,
        order: (last?.order ?? -1) + 1,
      },
    })

    emitChanges(['tasks'], key)
    return reply.code(201).send({ id: item.id })
  })

  app.patch('/api/checklist/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const schema = z.object({
      text: z.string().trim().min(1).max(300).optional(),
      done: z.boolean().optional(),
      assignee: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      order: z.number().int().min(0).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const item = await prisma.checklistItem.findFirst({
      where: { id, task: taskScope(req.user!) },
      include: { task: { select: { key: true, authorId: true, assigneeId: true } } },
    })
    if (!item) return reply.code(404).send({ error: 'Пункт не найден' })
    if (!(await canEditTask(req.user!, item.task))) {
      return reply.code(403).send({ error: 'Можно править только свои задачи' })
    }

    await prisma.checklistItem.update({
      where: { id },
      data: {
        ...(parsed.data.text !== undefined ? { text: parsed.data.text } : {}),
        ...(parsed.data.done !== undefined ? { done: parsed.data.done } : {}),
        ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
        ...(parsed.data.assignee !== undefined
          ? { assigneeId: (await resolveUser(parsed.data.assignee)) ?? null }
          : {}),
        ...(parsed.data.dueDate !== undefined ? { dueDate: toDate(parsed.data.dueDate) ?? null } : {}),
      },
    })

    emitChanges(['tasks'], item.task.key)
    return { ok: true }
  })

  app.delete('/api/checklist/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const item = await prisma.checklistItem.findFirst({
      where: { id, task: taskScope(req.user!) },
      include: { task: { select: { key: true, authorId: true, assigneeId: true } } },
    })
    if (!item) return reply.code(404).send({ error: 'Пункт не найден' })
    if (!(await canEditTask(req.user!, item.task))) {
      return reply.code(403).send({ error: 'Можно править только свои задачи' })
    }

    await prisma.checklistItem.delete({ where: { id } })
    emitChanges(['tasks'], item.task.key)
    return { ok: true }
  })

  /**
   * Превращение пункта в подзадачу: исполнитель и срок переносятся,
   * пункт остаётся и ссылается на созданную задачу.
   */
  app.post('/api/checklist/:id/promote', async (req, reply) => {
    if (!(await requirePerm(req, reply, 'task.create'))) return

    const { id } = req.params as { id: string }
    const item = await prisma.checklistItem.findFirst({
      where: { id, task: taskScope(req.user!) },
      include: { task: { include: { queue: { include: { workflow: { include: { statuses: { orderBy: { order: 'asc' } } } } } } } } },
    })
    if (!item) return reply.code(404).send({ error: 'Пункт не найден' })
    if (item.spawnedKey) {
      return reply.code(409).send({ error: `Пункт уже превращён в ${item.spawnedKey}` })
    }

    const queue = item.task.queue
    const status = queue.workflow.statuses[0]
    if (!status) return reply.code(400).send({ error: 'У схемы очереди нет статусов' })

    const num = await prisma.$transaction(async (tx) => {
      const updated = await tx.queue.update({
        where: { id: queue.id },
        data: { counter: { increment: 1 } },
        select: { counter: true },
      })
      return updated.counter
    })

    const type = await prisma.taskType.findFirst({ orderBy: { order: 'asc' } })

    const created = await prisma.task.create({
      data: {
        key: `${queue.key}-${num}`,
        num,
        queueId: queue.id,
        title: item.text,
        statusId: status.id,
        typeId: type?.id ?? null,
        assigneeId: item.assigneeId,
        authorId: req.user!.id,
        projectId: item.task.projectId,
        sprintId: item.task.sprintId,
        parentId: item.task.id,
        dueDate: item.dueDate,
        rank: Date.now(),
      },
    })

    await prisma.checklistItem.update({ where: { id }, data: { spawnedKey: created.key } })
    await record({
      taskId: item.task.id,
      actorId: req.user!.id,
      kind: 'created',
      note: `превратил(а) пункт чек-листа в подзадачу ${created.key}`,
    })

    emitChanges(['tasks', 'board'], item.task.key)
    return reply.code(201).send({ key: created.key })
  })

  /* ── Наблюдатели ──────────────────────────────────────────────────── */

  app.post('/api/tasks/:key/watch', async (req, reply) => {
    const { key } = req.params as { key: string }
    const task = await prisma.task.findFirst({ where: visibleTask(req.user!, key) })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const existing = await prisma.watcher.findUnique({
      where: { taskId_userId: { taskId: task.id, userId: req.user!.id } },
    })
    if (existing) {
      await prisma.watcher.delete({
        where: { taskId_userId: { taskId: task.id, userId: req.user!.id } },
      })
      return { watching: false }
    }
    await watch(task.id, req.user!.id)
    return { watching: true }
  })

  app.post('/api/tasks/:key/watchers', async (req, reply) => {
    const { key } = req.params as { key: string }
    const schema = z.object({ user: z.string() })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Укажите участника' })

    const task = await prisma.task.findFirst({ where: visibleTask(req.user!, key) })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const userId = await resolveUser(parsed.data.user)
    if (!userId) return reply.code(404).send({ error: 'Участник не найден' })

    await watch(task.id, userId)
    emitChanges(['tasks'], task.key)
    return { ok: true }
  })

  app.delete('/api/tasks/:key/watchers/:user', async (req, reply) => {
    const { key, user } = req.params as { key: string; user: string }
    const task = await prisma.task.findFirst({ where: visibleTask(req.user!, key) })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const userId = await resolveUser(user)
    if (!userId) return reply.code(404).send({ error: 'Участник не найден' })

    await prisma.watcher
      .delete({ where: { taskId_userId: { taskId: task.id, userId } } })
      .catch(() => undefined)
    emitChanges(['tasks'], task.key)
    return { ok: true }
  })

  /* ── Связи ────────────────────────────────────────────────────────── */

  app.post('/api/tasks/:key/links', async (req, reply) => {
    const { key } = req.params as { key: string }
    const schema = z.object({
      target: z.string().trim().min(1),
      type: z.enum(LINK_TYPES).default('relates'),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Укажите задачу и тип связи' })

    const [from, to] = await Promise.all([
      prisma.task.findFirst({ where: visibleTask(req.user!, key) }),
      prisma.task.findFirst({ where: visibleTask(req.user!, parsed.data.target) }),
    ])
    if (!from || !to) return reply.code(404).send({ error: 'Задача не найдена' })
    if (from.id === to.id) return reply.code(400).send({ error: 'Нельзя связать задачу с собой' })

    await prisma.taskLink.upsert({
      where: { fromId_toId_type: { fromId: from.id, toId: to.id, type: parsed.data.type } },
      create: { fromId: from.id, toId: to.id, type: parsed.data.type },
      update: {},
    })

    await record({
      taskId: from.id,
      actorId: req.user!.id,
      kind: 'link',
      note: `добавил(а) связь «${linkLabel(parsed.data.type, false)} ${to.key}»`,
    })
    await notify({
      userIds: await taskAudience(to.id),
      actorId: req.user!.id,
      taskId: to.id,
      kind: 'link',
      text: `${req.user!.name} связал(а) задачу с ${from.key}`,
    })

    emitChanges(['tasks'], from.key)
    return { ok: true }
  })

  app.delete('/api/links/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    // Связь удаляется только из задачи, которая пользователю видна.
    const link = await prisma.taskLink.findFirst({
      where: { id, from: taskScope(req.user!) },
    })
    if (!link) return reply.code(404).send({ error: 'Связь не найдена' })

    await prisma.taskLink.delete({ where: { id } }).catch(() => undefined)
    emitChanges(['tasks'])
    return { ok: true }
  })

  /* ── Списание времени ─────────────────────────────────────────────── */

  app.post('/api/tasks/:key/worklog', async (req, reply) => {
    const { key } = req.params as { key: string }
    const schema = z.object({
      minutes: z.number().int().min(1).max(24 * 60),
      note: z.string().default(''),
      spentOn: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Укажите количество минут' })

    const task = await prisma.task.findFirst({ where: visibleTask(req.user!, key) })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const created = await prisma.worklog.create({
      data: {
        taskId: task.id,
        userId: req.user!.id,
        minutes: parsed.data.minutes,
        note: parsed.data.note,
        spentOn: toDate(parsed.data.spentOn) ?? new Date(),
      },
    })
    await record({
      taskId: task.id,
      actorId: req.user!.id,
      kind: 'worklog',
      note: `списал(а) ${formatMinutes(parsed.data.minutes)}`,
    })

    emitChanges(['tasks'], task.key)
    return reply.code(201).send({ id: created.id })
  })

  app.delete('/api/worklog/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const entry = await prisma.worklog.findFirst({
      where: { id, task: taskScope(req.user!) },
      include: { task: { select: { key: true } } },
    })
    if (!entry) return reply.code(404).send({ error: 'Запись не найдена' })

    // Своё списание убирает автор, чужое — тот, кто правит чужие задачи.
    const mine = entry.userId === req.user!.id
    if (!mine && !(await can(req.user!.role, 'task.editForeign'))) {
      return reply.code(403).send({ error: 'Можно удалять только свои списания' })
    }

    await prisma.worklog.delete({ where: { id } })
    emitChanges(['tasks'], entry.task.key)
    return { ok: true }
  })

  /* ── Вложения ─────────────────────────────────────────────────────── */

  app.post('/api/tasks/:key/attachments', async (req, reply) => {
    const { key } = req.params as { key: string }
    const task = await prisma.task.findFirst({ where: visibleTask(req.user!, key) })
    if (!task) return reply.code(404).send({ error: 'Задача не найдена' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'Файл не передан' })

    await mkdir(UPLOAD_DIR, { recursive: true })
    // Имя на диске генерируется сервером: пользовательское имя не участвует
    // в пути, поэтому выйти за пределы каталога невозможно.
    const storedName = `${randomBytes(16).toString('hex')}${path.extname(file.filename).slice(0, 12)}`
    const target = path.join(UPLOAD_DIR, storedName)

    await pipeline(file.file, createWriteStream(target))
    if (file.file.truncated) {
      await unlink(target).catch(() => undefined)
      return reply.code(413).send({ error: 'Файл больше 25 МБ' })
    }

    const { size } = await stat(target)
    const attachment = await prisma.attachment.create({
      data: {
        taskId: task.id,
        filename: path.basename(file.filename),
        storedName,
        mime: file.mimetype,
        size,
        uploadedById: req.user!.id,
      },
    })

    await record({
      taskId: task.id,
      actorId: req.user!.id,
      kind: 'attachment',
      note: `добавил(а) вложение ${attachment.filename}`,
    })
    emitChanges(['tasks'], task.key)

    return reply.code(201).send({
      id: attachment.id,
      filename: attachment.filename,
      size: attachment.size,
      mime: attachment.mime,
      url: `${BASE_PATH}/api/attachments/${attachment.id}`,
    })
  })

  app.get('/api/attachments/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const attachment = await prisma.attachment.findFirst({
      where: { id, task: taskScope(req.user!) },
    })
    if (!attachment) return reply.code(404).send({ error: 'Вложение не найдено' })

    // Имя файла на диске сгенерировано сервером, но путь всё равно
    // нормализуется и проверяется — на случай правки записи в обход API.
    const target = path.resolve(UPLOAD_DIR, attachment.storedName)
    if (!target.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
      return reply.code(400).send({ error: 'Некорректный путь' })
    }

    const encoded = encodeURIComponent(attachment.filename)
    reply
      .type(attachment.mime || 'application/octet-stream')
      .header('Content-Disposition', `inline; filename*=UTF-8''${encoded}`)
      // Браузер не должен исполнять содержимое вложения как страницу.
      .header('Content-Security-Policy', "default-src 'none'; sandbox")
      .header('X-Content-Type-Options', 'nosniff')
    return reply.send(createReadStream(target))
  })

  app.delete('/api/attachments/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const attachment = await prisma.attachment.findFirst({
      where: { id, task: taskScope(req.user!) },
    })
    if (!attachment) return reply.code(404).send({ error: 'Вложение не найдено' })

    const mine = attachment.uploadedById === req.user!.id
    if (!mine && !(await can(req.user!.role, 'task.editForeign'))) {
      return reply.code(403).send({ error: 'Недостаточно прав' })
    }

    await unlink(path.join(UPLOAD_DIR, attachment.storedName)).catch(() => undefined)
    await prisma.attachment.delete({ where: { id } })
    emitChanges(['tasks'])
    return { ok: true }
  })
}
