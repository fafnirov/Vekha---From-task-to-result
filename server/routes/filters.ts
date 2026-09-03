/** Сохранённые фильтры и проверка запросов. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireTaskView } from '../lib/auth.js'
import { emitChanges } from '../lib/events.js'
import { parseQuery, QueryError, validateQuery } from '../lib/query.js'
import { taskScope } from '../lib/access.js'

export async function filterRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  /**
   * Список фильтров с числом попаданий: свои плюс те, которыми поделились.
   * Счётчик считается настоящим запросом, поэтому цифры не врут.
   */
  app.get('/api/filters', { preHandler: requireTaskView }, async (req) => {
    const rows = await prisma.savedFilter.findMany({
      where: { OR: [{ ownerId: req.user!.id }, { shared: true }] },
      include: { owner: { select: { code: true, name: true } } },
      orderBy: [{ favorite: 'desc' }, { createdAt: 'asc' }],
    })

    const ctx = { userId: req.user!.id, userCode: req.user!.code }

    const items = await Promise.all(
      rows.map(async (f) => {
        let n = 0
        let error: string | null = null
        try {
          n = await prisma.task.count({
            where: { AND: [taskScope(req.user!), parseQuery(f.query, ctx)] },
          })
        } catch (err) {
          error = err instanceof QueryError ? err.message : 'Ошибка запроса'
        }
        return {
          id: f.id,
          label: f.name,
          query: f.query,
          icon: f.icon,
          icf: f.iconFg,
          favorite: f.favorite,
          shared: f.shared,
          mine: f.ownerId === req.user!.id,
          owner: f.owner.code,
          ownerName: f.owner.name,
          n,
          error,
        }
      }),
    )

    return {
      favorites: items.filter((i) => i.favorite),
      saved: items.filter((i) => !i.favorite && i.mine),
      team: items.filter((i) => !i.mine && i.shared),
    }
  })

  app.post('/api/filters', async (req, reply) => {
    const schema = z.object({
      name: z.string().trim().min(2, 'Укажите название фильтра'),
      query: z.string().trim().min(1, 'Запрос пуст'),
      icon: z.string().default('filter_alt'),
      iconFg: z.string().default('var(--ac)'),
      favorite: z.boolean().default(false),
      shared: z.boolean().default(false),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const check = validateQuery(parsed.data.query)
    if (!check.ok) return reply.code(400).send({ error: check.error })

    const created = await prisma.savedFilter.create({
      data: { ...parsed.data, ownerId: req.user!.id },
    })

    emitChanges(['tasks'])
    return reply.code(201).send({ id: created.id })
  })

  app.patch('/api/filters/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      query: z.string().trim().min(1).optional(),
      favorite: z.boolean().optional(),
      shared: z.boolean().optional(),
      icon: z.string().optional(),
      iconFg: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const filter = await prisma.savedFilter.findUnique({ where: { id } })
    if (!filter) return reply.code(404).send({ error: 'Фильтр не найден' })
    if (filter.ownerId !== req.user!.id) {
      return reply.code(403).send({ error: 'Можно править только свои фильтры' })
    }

    if (parsed.data.query) {
      const check = validateQuery(parsed.data.query)
      if (!check.ok) return reply.code(400).send({ error: check.error })
    }

    await prisma.savedFilter.update({ where: { id }, data: parsed.data })
    return { ok: true }
  })

  app.delete('/api/filters/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const filter = await prisma.savedFilter.findUnique({ where: { id } })
    if (!filter) return reply.code(404).send({ error: 'Фильтр не найден' })
    if (filter.ownerId !== req.user!.id) {
      return reply.code(403).send({ error: 'Можно удалять только свои фильтры' })
    }
    await prisma.savedFilter.delete({ where: { id } })
    return { ok: true }
  })

  /** Проверка запроса и предпросмотр количества — для конструктора. */
  app.post('/api/filters/validate', async (req, reply) => {
    const schema = z.object({ query: z.string() })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Передайте запрос' })

    try {
      const where = parseQuery(parsed.data.query, {
        userId: req.user!.id,
        userCode: req.user!.code,
      })
      const n = await prisma.task.count({
        where: { AND: [taskScope(req.user!), where] },
      })
      return { ok: true, n }
    } catch (err) {
      return { ok: false, error: err instanceof QueryError ? err.message : 'Ошибка разбора' }
    }
  })

  /** Значения для выпадающих списков конструктора условий. */
  app.get('/api/filters/fields', async () => {
    const [queues, statuses, projects, sprints, tags, types, resolutions, people] = await Promise.all([
      prisma.queue.findMany({ select: { key: true, name: true }, orderBy: { key: 'asc' } }),
      prisma.status.findMany({
        select: { name: true, category: true },
        distinct: ['name'],
        orderBy: { order: 'asc' },
      }),
      prisma.project.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.sprint.findMany({ select: { name: true }, orderBy: { startDate: 'desc' } }),
      prisma.tag.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.taskType.findMany({ select: { name: true }, orderBy: { order: 'asc' } }),
      prisma.resolution.findMany({ select: { name: true }, orderBy: { order: 'asc' } }),
      prisma.user.findMany({
        where: { active: true },
        select: { code: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return {
      fields: [
        { key: 'queue', label: 'Очередь', icon: 'inbox', values: queues.map((q) => q.key) },
        { key: 'status', label: 'Статус', icon: 'flag', values: statuses.map((s) => s.name) },
        {
          key: 'priority',
          label: 'Приоритет',
          icon: 'priority_high',
          values: ['Критический', 'Высокий', 'Средний', 'Низкий'],
        },
        { key: 'assignee', label: 'Исполнитель', icon: 'person', values: people.map((p) => p.code) },
        { key: 'author', label: 'Автор', icon: 'edit', values: people.map((p) => p.code) },
        { key: 'project', label: 'Проект', icon: 'folder', values: projects.map((p) => p.name) },
        { key: 'sprint', label: 'Спринт', icon: 'rotate_right', values: sprints.map((s) => s.name) },
        { key: 'tag', label: 'Метка', icon: 'label', values: tags.map((t) => t.name) },
        { key: 'type', label: 'Тип задачи', icon: 'category', values: types.map((t) => t.name) },
        {
          key: 'resolution',
          label: 'Резолюция',
          icon: 'task_alt',
          values: [...resolutions.map((r) => r.name), 'empty()'],
        },
        {
          key: 'deadline',
          label: 'Срок',
          icon: 'calendar_today',
          values: ['now()', 'today()', 'endOfWeek()', 'endOfMonth()', 'empty()'],
        },
        { key: 'estimate', label: 'Оценка', icon: 'straighten', values: ['1', '2', '3', '5', '8', '13'] },
        { key: 'text', label: 'Текст', icon: 'search', values: [] },
      ],
      people: people.map((p) => ({ code: p.code, name: p.name })),
    }
  })
}
