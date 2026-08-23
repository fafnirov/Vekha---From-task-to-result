/**
 * История задачи и уведомления. Каждое изменение проходит через `record`,
 * поэтому лента активности, история задачи и колокольчик всегда согласованы.
 */

import { prisma } from './prisma.js'
import { emitChange } from './events.js'

export interface RecordInput {
  taskId: string
  /** null — действие выполнила автоматизация. */
  actorId: string | null
  kind: string
  note: string
  field?: string
  fromValue?: string
  toValue?: string
}

export async function record(input: RecordInput): Promise<void> {
  await prisma.activity.create({
    data: {
      taskId: input.taskId,
      actorId: input.actorId,
      kind: input.kind,
      note: input.note,
      field: input.field ?? '',
      fromValue: input.fromValue ?? '',
      toValue: input.toValue ?? '',
    },
  })
}

export interface NotifyInput {
  userIds: string[]
  actorId: string | null
  taskId: string | null
  kind: string
  text: string
}

/** Рассылает уведомления, пропуская автора действия. */
export async function notify(input: NotifyInput): Promise<void> {
  const targets = [...new Set(input.userIds)].filter((id) => id && id !== input.actorId)
  if (targets.length === 0) return

  await prisma.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      actorId: input.actorId,
      taskId: input.taskId,
      kind: input.kind,
      text: input.text,
    })),
  })

  for (const userId of targets) emitChange({ scope: 'notifications', userId })
}

/** Кого затрагивает событие по задаче: наблюдатели, исполнитель и автор. */
export async function taskAudience(taskId: string): Promise<string[]> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      authorId: true,
      assigneeId: true,
      watchers: { select: { userId: true } },
    },
  })
  if (!task) return []
  return [
    task.authorId,
    ...(task.assigneeId ? [task.assigneeId] : []),
    ...task.watchers.map((w) => w.userId),
  ]
}

const MENTION_RE = /@([A-Za-zА-Яа-яЁё][\w.-]{1,31})/g

/**
 * Ищет в тексте упоминания вида `@ivanov` или `@AK` и возвращает id людей.
 * Сопоставление идёт по коду, части email и первому слову имени —
 * так работает большинство трекеров и не требует автодополнения на клиенте.
 */
export async function findMentions(text: string): Promise<string[]> {
  const handles = [...text.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase())
  if (handles.length === 0) return []

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, code: true, email: true, name: true },
  })

  const hits = new Set<string>()
  for (const handle of handles) {
    for (const u of users) {
      const local = u.email.split('@')[0].toLowerCase()
      const first = u.name.split(/\s+/)[0].toLowerCase()
      if (u.code.toLowerCase() === handle || local === handle || first === handle) {
        hits.add(u.id)
      }
    }
  }
  return [...hits]
}

/** Добавляет наблюдателя, если его ещё нет. */
export async function watch(taskId: string, userId: string): Promise<void> {
  await prisma.watcher.upsert({
    where: { taskId_userId: { taskId, userId } },
    create: { taskId, userId },
    update: {},
  })
}
