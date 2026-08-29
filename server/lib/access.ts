/**
 * Видимость очередей.
 *
 * Уровень доступа очереди раньше только рисовался бейджем и ни на что не
 * влиял: задачи «закрытой» очереди отдавались любому вошедшему. Здесь
 * собрано одно правило, которое подмешивается во все выборки задач.
 *
 *   company, team — видят все участники организации
 *   restricted    — админы, лиды и владелец очереди
 *   private       — только админы и владелец очереди
 */

import type { Prisma } from '@prisma/client'
import type { SessionUser } from './auth.js'

/** Уровни, открытые всем вошедшим. */
const OPEN = ['company', 'team']

/** Уровни, доступные лидам. */
const MANAGER = [...OPEN, 'restricted']

/**
 * Условие видимости для запросов по задачам. Для админа пусто —
 * ему доступно всё, и лишний фильтр только мешал бы планировщику.
 */
export function taskScope(user: SessionUser): Prisma.TaskWhereInput {
  if (user.role === 'admin') return {}

  const allowed = user.role === 'manager' ? MANAGER : OPEN

  return {
    OR: [
      { queue: { access: { in: allowed } } },
      // Владелец видит свою очередь независимо от уровня доступа.
      { queue: { ownerId: user.id } },
    ],
  }
}

/** Та же логика для одной очереди — для проверок перед изменением. */
export function canSeeQueue(
  user: SessionUser,
  queue: { access: string; ownerId: string },
): boolean {
  if (user.role === 'admin') return true
  if (queue.ownerId === user.id) return true
  const allowed = user.role === 'manager' ? MANAGER : OPEN
  return allowed.includes(queue.access)
}

/** Условие видимости для выборок по очередям. */
export function queueScope(user: SessionUser): Prisma.QueueWhereInput {
  if (user.role === 'admin') return {}
  const allowed = user.role === 'manager' ? MANAGER : OPEN
  return { OR: [{ access: { in: allowed } }, { ownerId: user.id }] }
}

/**
 * Условие поиска задачи по ключу с учётом видимости очереди.
 *
 * Проверка доступа встроена в сам запрос, поэтому её нельзя забыть на
 * очередном подмаршруте: комментарии, историю и вложения закрытой очереди
 * раньше отдавал любой прямой вызов, минуя проверку на карточке.
 *
 *   const task = await prisma.task.findFirst({ where: visibleTask(user, key) })
 */
export function visibleTask(user: SessionUser, key: string): Prisma.TaskWhereInput {
  return { AND: [{ key: key.toUpperCase() }, taskScope(user)] }
}
