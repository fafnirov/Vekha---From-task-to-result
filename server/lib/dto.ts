/**
 * Преобразование записей Prisma в объекты, которые ждут экраны.
 * Здесь же живут визуальные атрибуты (цвета, иконки) — они выражены
 * переменными дизайн-системы, поэтому темы переключаются без участия сервера.
 */

import type { Prisma } from '@prisma/client'
import {
  ACCESS_LABEL,
  ACCESS_STYLE,
  LINK_INVERSE_LABEL,
  LINK_LABEL,
  PRIORITY_LABEL,
  PROJECT_STATE_LABEL,
  PROJECT_STATE_STYLE,
  type Priority,
} from './constants.js'
import { DASH, dueState, pct, relativeTime, shortDate, timestampLabel } from './format.js'

/* ── Люди ─────────────────────────────────────────────────────────────── */

export type UserRow = Prisma.UserGetPayload<object>

export interface PersonDto {
  id: string
  code: string
  who: string
  name: string
  /** Должность — то, что видно под именем в интерфейсе. */
  role: string
  /** Роль доступа: admin | manager | member | viewer. */
  accessRole: string
  email: string
  bg: string
  fg: string
  active: boolean
}

export function personDto(u: UserRow): PersonDto {
  return {
    id: u.id,
    code: u.code,
    who: u.initials,
    name: u.name,
    role: u.jobTitle || '—',
    accessRole: u.role,
    email: u.email,
    bg: u.avatarBg,
    fg: u.avatarFg,
    active: u.active,
  }
}

/* ── Задачи ───────────────────────────────────────────────────────────── */

const TASK_INCLUDE = {
  status: true,
  queue: { select: { key: true } },
  assignee: { select: { id: true, code: true } },
  author: { select: { id: true, code: true } },
  project: { select: { id: true, name: true } },
  sprint: { select: { id: true, name: true } },
  parent: { select: { key: true, title: true } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true, attachments: true, subtasks: true } },
} satisfies Prisma.TaskInclude

export const taskInclude = TASK_INCLUDE

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>

export interface TaskDto {
  id: string
  key: string
  num: number
  title: string
  description: string
  status: string
  statusId: string
  statusCategory: string
  priority: string
  priorityKey: string
  who: string | null
  assigneeId: string | null
  authorCode: string
  authorId: string
  project: string
  projectId: string | null
  queue: string
  queueId: string
  sprint: string
  sprintId: string | null
  parentKey: string | null
  due: string
  dueDate: string | null
  dueState: 'over' | 'today' | undefined
  est: number
  tags: string[]
  rank: number
  createdAt: string
  updatedAt: string
  closedAt: string | null
  comments: number
  attachments: number
  subtasks: number
}

export function taskDto(t: TaskRow, now = new Date()): TaskDto {
  const closed = t.status.category === 'done'
  return {
    id: t.id,
    key: t.key,
    num: t.num,
    title: t.title,
    description: t.description,
    status: t.status.name,
    statusId: t.statusId,
    statusCategory: t.status.category,
    priority: PRIORITY_LABEL[t.priority as Priority] ?? 'Medium',
    priorityKey: t.priority,
    who: t.assignee?.code ?? null,
    assigneeId: t.assigneeId,
    authorCode: t.author.code,
    authorId: t.authorId,
    project: t.project?.name ?? DASH,
    projectId: t.projectId,
    queue: t.queue.key,
    queueId: t.queueId,
    sprint: t.sprint?.name ?? DASH,
    sprintId: t.sprintId,
    parentKey: t.parent?.key ?? null,
    due: shortDate(t.dueDate),
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    dueState: dueState(t.dueDate, closed, now),
    est: t.estimate ?? 0,
    tags: t.tags.map((x) => x.tag.name).sort(),
    rank: t.rank,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    closedAt: t.closedAt ? t.closedAt.toISOString() : null,
    comments: t._count.comments,
    attachments: t._count.attachments,
    subtasks: t._count.subtasks,
  }
}

/* ── Очереди ──────────────────────────────────────────────────────────── */

export type QueueRow = Prisma.QueueGetPayload<{
  include: {
    owner: { select: { code: true } }
    workflow: { select: { id: true; name: true } }
    _count: { select: { tasks: true } }
  }
}>

export function queueDto(q: QueueRow) {
  const style = ACCESS_STYLE[q.access] ?? ACCESS_STYLE.team
  return {
    id: q.id,
    key: q.key,
    name: q.name,
    owner: q.owner.code,
    ownerId: q.ownerId,
    n: q._count.tasks,
    // Счётчик нумерации, а не количество задач: после удалений они расходятся.
    counter: q.counter,
    wf: q.workflow.name,
    workflowId: q.workflowId,
    access: ACCESS_LABEL[q.access] ?? q.access,
    accessKey: q.access,
    accBg: style.bg,
    accFg: style.fg,
  }
}

/* ── Проекты ──────────────────────────────────────────────────────────── */

export type ProjectRow = Prisma.ProjectGetPayload<{
  include: {
    lead: { select: { code: true } }
    queue: { select: { key: true } }
    milestones: true
    tasks: { select: { id: true; status: { select: { category: true } } } }
  }
}>

export function projectDto(p: ProjectRow, index = 0, palette: { bg: string; fg: string }[] = []) {
  const total = p.tasks.length
  const done = p.tasks.filter((t) => t.status.category === 'done').length
  const style = PROJECT_STATE_STYLE[p.state] ?? PROJECT_STATE_STYLE.active
  const tone = palette.length ? palette[index % palette.length] : { bg: 'var(--n-bg)', fg: 'var(--tx2)' }
  const next =
    p.milestones.find((m) => m.state === 'active') ??
    p.milestones.find((m) => m.state === 'planned') ??
    p.milestones[p.milestones.length - 1]

  return {
    id: p.id,
    name: p.name,
    abbr: p.abbr,
    description: p.description,
    bg: tone.bg,
    fg: tone.fg,
    done,
    total,
    pct: pct(done, total),
    due: shortDate(p.dueDate),
    dueDate: p.dueDate ? p.dueDate.toISOString() : null,
    startDate: p.startDate ? p.startDate.toISOString() : null,
    lead: p.lead.code,
    leadId: p.leadId,
    queue: p.queue.key,
    queueId: p.queueId,
    state: PROJECT_STATE_LABEL[p.state] ?? p.state,
    stateKey: p.state,
    stBg: style.bg,
    stFg: style.fg,
    milestone: next?.title ?? DASH,
    atRisk: p.state === 'risk',
  }
}

const MILESTONE_STYLE: Record<string, { icon: string; bg: string; fg: string; dateFg: string }> = {
  done: { icon: 'check', bg: 'var(--ok-bg)', fg: 'var(--ok)', dateFg: 'var(--tx2)' },
  active: { icon: 'sync', bg: 'var(--ac-soft)', fg: 'var(--ac-tx)', dateFg: 'var(--warn)' },
  planned: { icon: 'flag', bg: 'var(--n-bg)', fg: 'var(--tx2)', dateFg: 'var(--tx2)' },
}

const MILESTONE_LABEL: Record<string, string> = {
  done: 'выполнено',
  active: 'в работе',
  planned: 'запланировано',
}

export function milestoneDto(m: Prisma.MilestoneGetPayload<object>, longDateFn: (d: Date) => string) {
  const style = MILESTONE_STYLE[m.state] ?? MILESTONE_STYLE.planned
  return {
    id: m.id,
    title: m.title,
    note: m.note,
    date: longDateFn(m.date),
    dateISO: m.date.toISOString(),
    state: MILESTONE_LABEL[m.state] ?? m.state,
    stateKey: m.state,
    ...style,
  }
}

/* ── Спринты ──────────────────────────────────────────────────────────── */

export type SprintRow = Prisma.SprintGetPayload<{
  include: {
    queue: { select: { key: true } }
    tasks: { select: { estimate: true; assigneeId: true; status: { select: { category: true } } } }
  }
}>

export function sprintDto(s: SprintRow) {
  const points = s.tasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0)
  const donePoints = s.tasks
    .filter((t) => t.status.category === 'done')
    .reduce((sum, t) => sum + (t.estimate ?? 0), 0)
  return {
    id: s.id,
    name: s.name,
    queue: s.queue.key,
    queueId: s.queueId,
    goal: s.goal,
    state: s.state,
    capacity: s.capacity,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    range: `${shortDate(s.startDate)} – ${shortDate(s.endDate)}`,
    tasks: s.tasks.length,
    points,
    donePoints,
  }
}

/* ── Комментарии ──────────────────────────────────────────────────────── */

export type CommentRow = Prisma.CommentGetPayload<{
  include: { author: { select: { code: true; name: true; jobTitle: true } } }
}>

export function commentDto(c: CommentRow, now = new Date()) {
  return {
    id: c.id,
    who: c.author.code,
    authorId: c.authorId,
    time: timestampLabel(c.createdAt, now),
    createdAt: c.createdAt.toISOString(),
    text: c.body,
    edited: Boolean(c.editedAt),
  }
}

/* ── История и активность ─────────────────────────────────────────────── */

const ACTIVITY_STYLE: Record<string, { icon: string; bg: string; fg: string }> = {
  created: { icon: 'add', bg: 'var(--ok-bg)', fg: 'var(--ok)' },
  status: { icon: 'sync_alt', bg: 'var(--ac-soft)', fg: 'var(--ac-tx)' },
  priority: { icon: 'flag', bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  assignee: { icon: 'person', bg: 'var(--info-bg)', fg: 'var(--info)' },
  sprint: { icon: 'rotate_right', bg: 'var(--vio-bg)', fg: 'var(--vio)' },
  estimate: { icon: 'straighten', bg: 'var(--info-bg)', fg: 'var(--info)' },
  due: { icon: 'calendar_today', bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  comment: { icon: 'chat', bg: 'var(--ac-soft)', fg: 'var(--ac-tx)' },
  attachment: { icon: 'attach_file', bg: 'var(--n-bg)', fg: 'var(--tx2)' },
  link: { icon: 'link', bg: 'var(--n-bg)', fg: 'var(--tx2)' },
  automation: { icon: 'bolt', bg: 'var(--vio-bg)', fg: 'var(--vio)' },
  title: { icon: 'title', bg: 'var(--n-bg)', fg: 'var(--tx2)' },
  description: { icon: 'description', bg: 'var(--n-bg)', fg: 'var(--tx2)' },
  project: { icon: 'folder', bg: 'var(--n-bg)', fg: 'var(--tx2)' },
  closed: { icon: 'task_alt', bg: 'var(--ok-bg)', fg: 'var(--ok)' },
}

/** Цвет плашки «стало» повторяет палитру соответствующей сущности. */
const VALUE_TONE: Record<string, { bg: string; fg: string }> = {
  Critical: { bg: 'var(--dang-bg)', fg: 'var(--dang)' },
  High: { bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  Medium: { bg: 'var(--info-bg)', fg: 'var(--info)' },
  Low: { bg: 'var(--n-bg)', fg: 'var(--tx2)' },
}

export type ActivityRow = Prisma.ActivityGetPayload<{
  include: {
    actor: { select: { name: true; code: true } }
    task: { select: { key: true } }
  }
}>

export function historyDto(a: ActivityRow, now = new Date()) {
  const style = ACTIVITY_STYLE[a.kind] ?? ACTIVITY_STYLE.status
  const tone = VALUE_TONE[a.toValue]
  return {
    id: a.id,
    who: a.actor?.name ?? 'Автоматизация',
    whoCode: a.actor?.code ?? null,
    what: a.note,
    from: a.fromValue || undefined,
    to: a.toValue || undefined,
    toBg: tone?.bg,
    toFg: tone?.fg,
    key: a.task.key,
    time: timestampLabel(a.createdAt, now),
    createdAt: a.createdAt.toISOString(),
    kind: a.kind,
    ...style,
  }
}

/** Та же запись, но для ленты на главной — там показывается ключ задачи. */
export function feedDto(a: ActivityRow, now = new Date()) {
  const style = ACTIVITY_STYLE[a.kind] ?? ACTIVITY_STYLE.status
  return {
    id: a.id,
    who: a.actor?.name ?? 'Автоматизация',
    what: a.note,
    key: a.task.key,
    time: relativeTime(a.createdAt, now),
    ...style,
  }
}

/* ── Уведомления ──────────────────────────────────────────────────────── */

const NOTIFY_STYLE: Record<string, { icon: string; icFg: string; kind: string }> = {
  mention: { icon: 'alternate_email', icFg: 'var(--ac)', kind: 'упоминание' },
  comment: { icon: 'chat', icFg: 'var(--tx3)', kind: 'комментарий' },
  status: { icon: 'sync_alt', icFg: 'var(--ac)', kind: 'статус' },
  assigned: { icon: 'person_add', icFg: 'var(--info)', kind: 'назначение' },
  link: { icon: 'block', icFg: 'var(--dang)', kind: 'связь' },
  review: { icon: 'rate_review', icFg: 'var(--warn)', kind: 'ревью' },
  watch: { icon: 'visibility', icFg: 'var(--tx3)', kind: 'наблюдение' },
}

export type NotificationRow = Prisma.NotificationGetPayload<{
  include: {
    actor: { select: { code: true; name: true } }
    task: { select: { key: true } }
  }
}>

export function notificationDto(n: NotificationRow, now = new Date()) {
  const style = NOTIFY_STYLE[n.kind] ?? NOTIFY_STYLE.comment
  return {
    id: n.id,
    who: n.actor?.code ?? null,
    text: n.text,
    key: n.task?.key ?? '',
    time: relativeTime(n.createdAt, now),
    createdAt: n.createdAt.toISOString(),
    unread: n.readAt === null,
    kind: style.kind,
    kindKey: n.kind,
    icon: style.icon,
    icFg: style.icFg,
  }
}

/* ── Связи ────────────────────────────────────────────────────────────── */

export function linkLabel(type: string, inverse: boolean): string {
  return inverse ? (LINK_INVERSE_LABEL[type] ?? type) : (LINK_LABEL[type] ?? type)
}
