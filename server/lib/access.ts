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
      /*
       * Своя работа видна всегда, в какой бы очереди ни лежала.
       *
       * Без этого назначение молча ничего не делало: задачу поручали
       * человеку в закрытой для него очереди, в списках она не
       * появлялась, а по прямой ссылке отвечала «не найдена». Нельзя
       * поручить работу и не дать её увидеть — это не ограничение
       * доступа, а потерянная задача.
       */
      { assigneeId: user.id },
      { authorId: user.id },
      { watchers: { some: { userId: user.id } } },
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

/**
 * Видна ли человеку конкретная задача.
 *
 * Повторяет правило taskScope для одной уже загруженной записи: либо
 * очередь ему открыта, либо задача его собственная. Проверка по одной
 * очереди этого не учитывала, и назначенная задача, найденная в списке,
 * отвечала «не найдена» при открытии.
 */
export function canSeeTask(
  user: SessionUser,
  task: {
    queue: { access: string; ownerId: string }
    assigneeId?: string | null
    authorId?: string
    watchers?: { userId: string }[]
  },
): boolean {
  if (canSeeQueue(user, task.queue)) return true
  if (task.assigneeId === user.id) return true
  if (task.authorId === user.id) return true
  return (task.watchers ?? []).some((w) => w.userId === user.id)
}

/** Условие видимости для выборок по очередям. */
export function queueScope(user: SessionUser): Prisma.QueueWhereInput {
  if (user.role === 'admin') return {}
  const allowed = user.role === 'manager' ? MANAGER : OPEN
  return { OR: [{ access: { in: allowed } }, { ownerId: user.id }] }
}

/**
 * Условие видимости для выборок по проектам.
 *
 * Проект принадлежит очереди, но список проектов раньше отдавался целиком
 * любому вошедшему: название, описание, руководитель, срок и доля
 * выполненного утекали из очереди, закрытой от человека.
 */
export function projectScope(user: SessionUser): Prisma.ProjectWhereInput {
  if (user.role === 'admin') return {}

  const allowed = user.role === 'manager' ? MANAGER : OPEN
  const inVisibleQueue: Prisma.ProjectWhereInput = {
    OR: [{ queue: { access: { in: allowed } } }, { queue: { ownerId: user.id } }],
  }

  // Лид координирует работу, поэтому видит все проекты доступных очередей.
  if (user.role === 'manager') return inVisibleQueue

  /*
   * Участник и гость видят только те проекты, к которым причастны:
   * руководят ими или ведут в них задачу. Раньше видимость считалась
   * по одному лишь доступу к очереди, и человеку показывали чужие
   * проекты, к которым его никто не привлекал.
   */
  return {
    AND: [
      inVisibleQueue,
      {
        OR: [
          { leadId: user.id },
          { tasks: { some: { assigneeId: user.id } } },
          { tasks: { some: { authorId: user.id } } },
        ],
      },
    ],
  }
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
