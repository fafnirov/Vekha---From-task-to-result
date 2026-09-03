/** Отчёты: KPI, burndown, пропускная способность, нагрузка, просрочки. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireTaskView } from '../lib/auth.js'
import { personDto } from '../lib/dto.js'
import { daysBetween, overdueLabel, pct, plural, startOfDay } from '../lib/format.js'
import { taskScope } from '../lib/access.js'

/** Понедельник недели, в которую попадает дата. */
function weekStart(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/** Номер недели ISO — подпись столбцов «н34». */
function weekNumber(d: Date): number {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1))
  return Math.ceil(((x.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', requireTaskView)

  app.get('/api/reports', async (req) => {
    const p = z
      .object({ weeks: z.coerce.number().int().min(4).max(26).default(8), queue: z.string().optional() })
      .parse(req.query)

    const queueFilter = {
      ...taskScope(req.user!),
      ...(p.queue ? { queue: { key: p.queue } } : {}),
    }
    const now = new Date()
    const today = startOfDay(now)

    const tasks = await prisma.task.findMany({
      where: queueFilter,
      include: {
        status: { select: { name: true, category: true } },
        assignee: true,
      },
    })

    /* ── Распределение по статусам ──────────────────────────────────── */

    const buckets = [
      { label: 'Готово', c: 'var(--ok)', match: (c: string) => c === 'done' },
      { label: 'В работе', c: 'var(--ac)', match: (c: string) => c === 'inprogress' },
      { label: 'Заблокировано', c: 'var(--dang)', match: (c: string) => c === 'blocked' },
      { label: 'Ждёт', c: 'var(--info)', match: (c: string) => c === 'todo' },
    ]
    const statusSplit = buckets
      .map((b) => ({
        label: b.label,
        c: b.c,
        n: tasks.filter((t) => b.match(t.status.category)).length,
      }))
      .filter((b) => b.n > 0)

    /* ── Пропускная способность по неделям ──────────────────────────── */

    const from = weekStart(new Date(today.getTime() - (p.weeks - 1) * 7 * 86_400_000))
    const closed = tasks.filter((t) => t.closedAt && t.closedAt >= from)

    const weeks: { label: string; n: number; start: Date }[] = []
    for (let i = 0; i < p.weeks; i += 1) {
      const start = new Date(from.getTime() + i * 7 * 86_400_000)
      const end = new Date(start.getTime() + 7 * 86_400_000)
      weeks.push({
        label: `н${weekNumber(start)}`,
        start,
        n: closed.filter((t) => t.closedAt! >= start && t.closedAt! < end).length,
      })
    }
    const peak = Math.max(1, ...weeks.map((w) => w.n))
    const throughput = weeks.map((w) => ({
      label: w.label,
      n: w.n,
      h: `${Math.round((w.n / peak) * 100)}%`,
    }))

    /* ── KPI ────────────────────────────────────────────────────────── */

    const monthAgo = new Date(today.getTime() - 30 * 86_400_000)
    const prevMonth = new Date(today.getTime() - 60 * 86_400_000)

    const closedThis = tasks.filter((t) => t.closedAt && t.closedAt >= monthAgo).length
    const closedPrev = tasks.filter(
      (t) => t.closedAt && t.closedAt >= prevMonth && t.closedAt < monthAgo,
    ).length
    const delta = closedPrev ? Math.round(((closedThis - closedPrev) / closedPrev) * 100) : 0

    const cycleSamples = tasks
      .filter((t) => t.closedAt)
      .map((t) => (t.closedAt!.getTime() - t.createdAt.getTime()) / 86_400_000)
    const cycle = cycleSamples.length
      ? cycleSamples.reduce((a, b) => a + b, 0) / cycleSamples.length
      : 0

    const withDeadline = tasks.filter((t) => t.closedAt && t.dueDate)
    const onTime = withDeadline.filter((t) => t.closedAt! <= t.dueDate!).length
    const timeliness = withDeadline.length
      ? Math.round((onTime / withDeadline.length) * 100)
      : 100

    const overdueTasks = tasks.filter(
      (t) => t.dueDate && t.dueDate < today && t.status.category !== 'done',
    )

    const kpis = [
      {
        label: 'Закрыто задач',
        value: String(closedThis),
        delta: closedPrev ? `${delta >= 0 ? '+' : '−'}${Math.abs(delta)}%` : 'за 30 дней',
        fg: 'var(--tx)',
        deltaFg: delta >= 0 ? 'var(--ok)' : 'var(--dang)',
      },
      {
        label: 'Среднее время цикла',
        value: `${cycle.toFixed(1)}д`,
        delta: `${cycleSamples.length} ${plural(cycleSamples.length, 'задача', 'задачи', 'задач')}`,
        fg: 'var(--tx)',
        deltaFg: 'var(--tx3)',
      },
      {
        label: 'Соблюдение сроков',
        value: `${timeliness}%`,
        delta: 'цель 90%',
        fg: 'var(--tx)',
        deltaFg: timeliness >= 90 ? 'var(--ok)' : 'var(--tx3)',
      },
      {
        label: 'Просрочено',
        value: String(overdueTasks.length),
        delta: overdueTasks.length ? 'требует внимания' : 'чисто',
        fg: overdueTasks.length ? 'var(--dang)' : 'var(--ok)',
        deltaFg: overdueTasks.length ? 'var(--dang)' : 'var(--ok)',
      },
    ]

    /* ── Нагрузка сотрудников ───────────────────────────────────────── */

    const people = await prisma.user.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    })

    const workload = people.map((u) => {
      const mine = tasks.filter((t) => t.assigneeId === u.id)
      const sp = mine
        .filter((t) => t.status.category !== 'done')
        .reduce((sum, t) => sum + (t.estimate ?? 0), 0)
      const total = mine.length || 1
      const done = mine.filter((t) => t.status.category === 'done').length
      const prog = mine.filter((t) => t.status.category === 'inprogress').length
      const todo = mine.length - done - prog
      return {
        ...personDto(u),
        sp,
        tasks: mine.length,
        doneW: pct(done, total),
        progW: pct(prog, total),
        todoW: pct(todo, total),
      }
    })

    /* ── Метрики спринтов ───────────────────────────────────────────── */

    const sprints = await prisma.sprint.findMany({
      where: p.queue ? { queue: { key: p.queue } } : {},
      include: { tasks: { include: { status: { select: { category: true } } } } },
      orderBy: { startDate: 'asc' },
      take: 8,
    })

    const sprintMetrics = sprints.map((s) => {
      const planTotal = s.tasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0)
      const factTotal = s.tasks
        .filter((t) => t.status.category === 'done')
        .reduce((sum, t) => sum + (t.estimate ?? 0), 0)
      const ratio = planTotal ? Math.round((factTotal / planTotal) * 100) : 0
      return {
        label: s.name,
        plan: String(planTotal),
        fact: String(factTotal),
        pct: `${ratio}%`,
        fg: ratio >= 100 ? 'var(--ok)' : ratio >= 85 ? 'var(--warn)' : 'var(--ac)',
        state: s.state,
      }
    })

    /* ── Просрочки ──────────────────────────────────────────────────── */

    const overdue = overdueTasks
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .slice(0, 10)
      .map((t) => ({
        key: t.key,
        title: t.title,
        late: overdueLabel(t.dueDate!, now),
        days: -daysBetween(now, t.dueDate!),
      }))

    return { kpis, statusSplit, throughput, workload, sprintMetrics, overdue }
  })

  /**
   * Burndown активного спринта — отдельным маршрутом, чтобы график можно
   * было обновлять чаще остальной страницы.
   */
  app.get('/api/reports/burndown', async (req) => {
    const p = z.object({ sprint: z.string().optional(), queue: z.string().optional() }).parse(req.query)

    const sprint = p.sprint
      ? await prisma.sprint.findFirst({ where: { OR: [{ id: p.sprint }, { name: p.sprint }] } })
      : await prisma.sprint.findFirst({
          where: { state: 'active', ...(p.queue ? { queue: { key: p.queue } } : {}) },
          orderBy: { startDate: 'desc' },
        })

    if (!sprint) return { sprint: null, points: [], total: 0, remaining: 0 }

    const [tasks, snapshots] = await Promise.all([
      prisma.task.findMany({
        where: { sprintId: sprint.id },
        include: { status: { select: { category: true } } },
      }),
      prisma.burndownPoint.findMany({ where: { sprintId: sprint.id }, orderBy: { day: 'asc' } }),
    ])

    const total = tasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0)
    const remaining = tasks
      .filter((t) => t.status.category !== 'done')
      .reduce((sum, t) => sum + (t.estimate ?? 0), 0)

    const span = Math.max(1, daysBetween(sprint.startDate, sprint.endDate))
    const points = snapshots.map((s) => ({
      label: String(s.day.getDate()),
      remaining: s.remaining,
      ideal: s.ideal,
    }))

    const today = startOfDay(new Date())
    const already = snapshots.some((s) => startOfDay(s.day).getTime() === today.getTime())
    if (!already && today >= startOfDay(sprint.startDate)) {
      const elapsed = Math.min(span, Math.max(0, daysBetween(sprint.startDate, today)))
      points.push({
        label: String(today.getDate()),
        remaining,
        ideal: Math.max(0, Math.round(total * (1 - elapsed / span))),
      })
    }

    return {
      sprint: sprint.name,
      range: `${sprint.startDate.toISOString()}/${sprint.endDate.toISOString()}`,
      total,
      remaining,
      points,
    }
  })

  /** Накопительная диаграмма потока — как задачи распределены во времени. */
  app.get('/api/reports/flow', async (req) => {
    const p = z.object({ weeks: z.coerce.number().int().min(4).max(26).default(8) }).parse(req.query)

    const today = startOfDay(new Date())
    const from = weekStart(new Date(today.getTime() - (p.weeks - 1) * 7 * 86_400_000))

    const tasks = await prisma.task.findMany({
      select: { createdAt: true, closedAt: true },
    })

    const series = []
    for (let i = 0; i < p.weeks; i += 1) {
      const end = new Date(from.getTime() + (i + 1) * 7 * 86_400_000)
      const created = tasks.filter((t) => t.createdAt < end).length
      const done = tasks.filter((t) => t.closedAt && t.closedAt < end).length
      series.push({
        label: `н${weekNumber(new Date(from.getTime() + i * 7 * 86_400_000))}`,
        created,
        done,
        open: created - done,
      })
    }

    return { series }
  })
}
