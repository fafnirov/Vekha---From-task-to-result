/**
 * Движок автоматизаций.
 *
 * Правило — это триггер, условие и список действий. Условие и действия
 * хранятся в базе строками JSON:
 *
 *   condition: { "all": [ { "field": "status", "op": "eq", "value": "Review" } ] }
 *   actions:   { "actions": [ { "type": "notify", "role": "manager" } ] }
 *
 * Такой формат читается экраном настроек и при этом достаточно узкий,
 * чтобы правило нельзя было превратить в произвольный код.
 */

import { prisma } from './prisma.js'
import { notify, record, taskAudience } from './activity.js'
import { emitChanges } from './events.js'
import { PRIORITIES, PRIORITY_LABEL, PRIORITY_ORDER, type Priority } from './constants.js'
import { startOfDay } from './format.js'

export type Trigger = 'task_created' | 'status_changed' | 'task_closed' | 'schedule'

interface Clause {
  field: string
  op: 'eq' | 'neq' | 'in' | 'contains' | 'is'
  value: string | string[] | boolean
}

interface Condition {
  all?: Clause[]
  any?: Clause[]
}

interface Action {
  type:
    | 'notify'
    | 'set_priority'
    | 'raise_priority'
    | 'set_assignee'
    | 'set_status'
    | 'add_comment'
    | 'add_watcher'
    | 'add_tag'
  /** Значение действия: имя статуса, код приоритета, текст и т. п. */
  value?: string
  /** Кому уведомление: роль (admin/manager/…) либо `assignee`, `author`, `watchers`. */
  role?: string
}

function parse<T>(raw: string, fallback: T): T {
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? (value as T) : fallback
  } catch {
    return fallback
  }
}

/* ── Контекст задачи для проверки условий ─────────────────────────────── */

interface Facts {
  status: string
  statusCategory: string
  priority: string
  queue: string
  project: string
  assignee: string
  tags: string[]
  overdue: boolean
  subtasksAllDone: boolean
  estimate: number
}

async function factsOf(taskId: string): Promise<Facts | null> {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      status: true,
      queue: { select: { key: true } },
      project: { select: { name: true } },
      assignee: { select: { code: true } },
      tags: { include: { tag: true } },
      subtasks: { include: { status: { select: { category: true } } } },
    },
  })
  if (!t) return null

  const now = new Date()
  return {
    status: t.status.name,
    statusCategory: t.status.category,
    priority: PRIORITY_LABEL[t.priority as Priority] ?? t.priority,
    queue: t.queue.key,
    project: t.project?.name ?? '',
    assignee: t.assignee?.code ?? '',
    tags: t.tags.map((x) => x.tag.name),
    overdue:
      t.dueDate !== null &&
      t.status.category !== 'done' &&
      startOfDay(t.dueDate) < startOfDay(now),
    subtasksAllDone:
      t.subtasks.length > 0 && t.subtasks.every((s) => s.status.category === 'done'),
    estimate: t.estimate ?? 0,
  }
}

function fieldValue(facts: Facts, field: string): string | string[] | boolean | number {
  switch (field) {
    case 'status':
      return facts.status
    case 'category':
      return facts.statusCategory
    case 'priority':
      return facts.priority
    case 'queue':
      return facts.queue
    case 'project':
      return facts.project
    case 'assignee':
      return facts.assignee
    case 'tags':
      return facts.tags
    case 'overdue':
      return facts.overdue
    case 'subtasksAllDone':
      return facts.subtasksAllDone
    case 'estimate':
      return facts.estimate
    default:
      return ''
  }
}

function matchClause(facts: Facts, clause: Clause): boolean {
  const actual = fieldValue(facts, clause.field)
  switch (clause.op) {
    case 'eq':
      return String(actual) === String(clause.value)
    case 'neq':
      return String(actual) !== String(clause.value)
    case 'in':
      return Array.isArray(clause.value) && clause.value.map(String).includes(String(actual))
    case 'contains':
      return Array.isArray(actual) && actual.map(String).includes(String(clause.value))
    case 'is':
      return Boolean(actual) === Boolean(clause.value)
    default:
      return false
  }
}

function matches(facts: Facts, condition: Condition): boolean {
  const all = condition.all ?? []
  const any = condition.any ?? []
  if (all.length && !all.every((c) => matchClause(facts, c))) return false
  if (any.length && !any.some((c) => matchClause(facts, c))) return false
  return true
}

/* ── Исполнение действий ──────────────────────────────────────────────── */

async function audienceFor(taskId: string, role: string | undefined): Promise<string[]> {
  if (!role || role === 'watchers') return taskAudience(taskId)

  if (role === 'assignee' || role === 'author') {
    const t = await prisma.task.findUnique({
      where: { id: taskId },
      select: { assigneeId: true, authorId: true },
    })
    const id = role === 'assignee' ? t?.assigneeId : t?.authorId
    return id ? [id] : []
  }

  const users = await prisma.user.findMany({
    where: { role, active: true },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

async function runAction(ruleName: string, taskId: string, action: Action): Promise<boolean> {
  switch (action.type) {
    case 'set_priority':
    case 'raise_priority': {
      const raw = action.value ?? 'high'
      if (!(PRIORITIES as readonly string[]).includes(raw)) {
        console.warn(`Правило «${ruleName}»: неизвестный приоритет «${raw}»`)
        return false
      }
      const value = raw as Priority
      const current = await prisma.task.findUnique({
        where: { id: taskId },
        select: { priority: true },
      })
      if (!current || current.priority === value) return false
      // «Поднять» не должно понижать: Critical остаётся Critical.
      if (
        action.type === 'raise_priority' &&
        PRIORITY_ORDER[current.priority as Priority] <= PRIORITY_ORDER[value]
      ) {
        return false
      }
      await prisma.task.update({ where: { id: taskId }, data: { priority: value } })
      await record({
        taskId,
        actorId: null,
        kind: 'automation',
        note:
          action.type === 'raise_priority'
            ? `подняла приоритет по правилу «${ruleName}»`
            : `изменила приоритет по правилу «${ruleName}»`,
        field: 'priority',
        fromValue: PRIORITY_LABEL[current.priority as Priority] ?? current.priority,
        toValue: PRIORITY_LABEL[value] ?? value,
      })
      return true
    }

    case 'set_status': {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { queue: { select: { workflowId: true } }, status: true },
      })
      if (!task || !action.value || task.status.name === action.value) return false
      const next = await prisma.status.findFirst({
        where: { workflowId: task.queue.workflowId, name: action.value },
      })
      if (!next) return false

      // Автоматизация подчиняется тому же воркфлоу, что и человек: иначе
      // задача попадёт в статус, из которого её потом никто не вытащит.
      const allowed = await prisma.transition.findUnique({
        where: { fromId_toId: { fromId: task.statusId, toId: next.id } },
      })
      if (!allowed) {
        console.warn(
          `Правило «${ruleName}»: переход ${task.status.name} → ${next.name} не разрешён воркфлоу`,
        )
        return false
      }

      await prisma.task.update({
        where: { id: taskId },
        data: {
          statusId: next.id,
          // Уже закрытой задаче дату закрытия не переписываем.
          closedAt: next.category === 'done' ? (task.closedAt ?? new Date()) : null,
        },
      })
      await record({
        taskId,
        actorId: null,
        kind: 'automation',
        note: `перевела задачу по правилу «${ruleName}»`,
        field: 'status',
        fromValue: task.status.name,
        toValue: next.name,
      })
      return true
    }

    case 'set_assignee': {
      const user = action.value
        ? await prisma.user.findFirst({
            where: { OR: [{ code: action.value }, { email: action.value }], active: true },
          })
        : null
      if (!user) return false
      const current = await prisma.task.findUnique({
        where: { id: taskId },
        select: { assigneeId: true },
      })
      if (current?.assigneeId === user.id) return false
      await prisma.task.update({ where: { id: taskId }, data: { assigneeId: user.id } })
      await record({
        taskId,
        actorId: null,
        kind: 'automation',
        note: `назначила исполнителя по правилу «${ruleName}»`,
        field: 'assignee',
        toValue: user.name,
      })
      await notify({
        userIds: [user.id],
        actorId: null,
        taskId,
        kind: 'assigned',
        text: `Автоматизация назначила вас исполнителем`,
      })
      return true
    }

    case 'add_comment': {
      const author = await prisma.user.findFirst({
        where: { role: 'admin' },
        orderBy: { createdAt: 'asc' },
      })
      if (!author || !action.value) return false
      await prisma.comment.create({
        data: { taskId, authorId: author.id, body: action.value },
      })
      await record({
        taskId,
        actorId: null,
        kind: 'automation',
        note: `добавила комментарий по правилу «${ruleName}»`,
      })
      return true
    }

    case 'add_watcher': {
      const user = action.value
        ? await prisma.user.findFirst({ where: { code: action.value }, select: { id: true } })
        : null
      if (!user) return false
      await prisma.watcher.upsert({
        where: { taskId_userId: { taskId, userId: user.id } },
        create: { taskId, userId: user.id },
        update: {},
      })
      return true
    }

    case 'add_tag': {
      if (!action.value) return false
      const tag = await prisma.tag.upsert({
        where: { name: action.value },
        create: { name: action.value },
        update: {},
      })
      await prisma.taskTag.upsert({
        where: { taskId_tagId: { taskId, tagId: tag.id } },
        create: { taskId, tagId: tag.id },
        update: {},
      })
      return true
    }

    case 'notify': {
      const userIds = await audienceFor(taskId, action.role)
      if (userIds.length === 0) return false
      await notify({
        userIds,
        actorId: null,
        taskId,
        kind: 'review',
        text: action.value ?? `Сработало правило «${ruleName}»`,
      })
      await record({
        taskId,
        actorId: null,
        kind: 'automation',
        note: `уведомила по правилу «${ruleName}»`,
      })
      return true
    }

    default:
      return false
  }
}

/* ── Точки входа ──────────────────────────────────────────────────────── */

/**
 * Прогоняет правила очереди по событию. Ошибка одного правила не должна
 * ронять запрос пользователя, поэтому исключения только логируются.
 */
export async function runRules(trigger: Trigger, taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { queueId: true },
  })
  if (!task) return

  const rules = await prisma.automationRule.findMany({
    where: {
      enabled: true,
      trigger,
      OR: [{ queueId: task.queueId }, { queueId: null }],
    },
    // Без явного порядка исход зависел бы от того, как СУБД вернёт строки.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  if (rules.length === 0) return

  let facts = await factsOf(taskId)
  if (!facts) return

  let touched = false

  for (const rule of rules) {
    try {
      if (!matches(facts, parse<Condition>(rule.condition, {}))) continue
      const actions = parse<{ actions: Action[] }>(rule.action, { actions: [] }).actions ?? []
      let fired = false
      for (const action of actions) {
        if (await runAction(rule.name, taskId, action)) fired = true
      }
      if (fired) {
        touched = true
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { runCount: { increment: 1 }, lastRunAt: new Date() },
        })
        // Следующее правило должно видеть уже изменённую задачу, иначе
        // два правила сработают на одном и том же «старом» статусе.
        facts = (await factsOf(taskId)) ?? facts
      }
    } catch (err) {
      console.error(`Автоматизация «${rule.name}» завершилась ошибкой:`, err)
    }
  }

  if (touched) emitChanges(['tasks', 'board', 'notifications'], taskId)
}

/**
 * Ежедневный прогон правил с триггером `schedule`: просроченные дедлайны,
 * напоминания и всё, что не привязано к действию пользователя.
 */
export async function runScheduledRules(): Promise<number> {
  const rules = await prisma.automationRule.findMany({
    where: { enabled: true, trigger: 'schedule' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  if (rules.length === 0) return 0

  const open = await prisma.task.findMany({
    where: { status: { category: { not: 'done' } } },
    select: { id: true, queueId: true },
  })

  let fired = 0
  for (const task of open) {
    let facts = await factsOf(task.id)
    if (!facts) continue

    for (const rule of rules) {
      if (rule.queueId && rule.queueId !== task.queueId) continue
      try {
        if (!matches(facts, parse<Condition>(rule.condition, {}))) continue
        const actions = parse<{ actions: Action[] }>(rule.action, { actions: [] }).actions ?? []
        let ran = false
        for (const action of actions) {
          if (await runAction(rule.name, task.id, action)) ran = true
        }
        if (ran) {
          fired += 1
          await prisma.automationRule.update({
            where: { id: rule.id },
            data: { runCount: { increment: 1 }, lastRunAt: new Date() },
          })
          facts = (await factsOf(task.id)) ?? facts
        }
      } catch (err) {
        console.error(`Автоматизация «${rule.name}» завершилась ошибкой:`, err)
      }
    }
  }

  if (fired) emitChanges(['tasks', 'board', 'notifications'])
  return fired
}
