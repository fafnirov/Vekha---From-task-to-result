/**
 * Кто что видит.
 *
 * Правило одно: очередь открывается командам, и решает это администратор
 * в её настройках.
 *
 *   Админ           — все очереди, он же и настраивает доступ.
 *   Лид             — все очереди организации: он координирует работу.
 *   Участник, гость — только очереди тех команд, в которых состоят.
 *
 * Прежние уровни доступа убраны: они врали. Уровень с названием
 * «команда» на деле означал «любой, кто вошёл», и участник видел все
 * очереди подряд — ровно на это и пожаловался владелец.
 *
 * Поверх этого действует сквозное правило: своя работа видна всегда.
 * Задача, назначенная человеку, остаётся ему видна, даже если очередь
 * ему не открыта, — иначе поручение молча теряло бы задачу.
 */

import type { Prisma } from '@prisma/client'
import type { SessionUser } from './auth.js'

/** Роли, которым открыты все очереди без всякой настройки. */
function seesEveryQueue(user: SessionUser): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

/** Очереди, открытые командам этого человека, плюс его собственные. */
function reachableQueue(user: SessionUser): Prisma.QueueWhereInput {
  return {
    OR: [
      { teams: { some: { members: { some: { userId: user.id } } } } },
      // Владелец очереди видит её всегда: он за неё и отвечает.
      { ownerId: user.id },
    ],
  }
}

/**
 * Условие видимости для запросов по задачам. Для админа и лида пусто —
 * им доступно всё, и лишний фильтр только мешал бы планировщику.
 */
export function taskScope(user: SessionUser): Prisma.TaskWhereInput {
  if (seesEveryQueue(user)) return {}

  return {
    OR: [
      /*
       * Своя работа видна всегда: в какой бы очереди ни лежала и какой
       * бы команде ни была поручена.
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
      { team: { members: { some: { userId: user.id } } } },

      /*
       * Всё прочее — если очередь открыта его команде И задача не отдана
       * чужой команде. Команда сужает видимость внутри очереди:
       * поручённое команде видит она, а не все, кому очередь доступна.
       */
      {
        AND: [
          { queue: reachableQueue(user) },
          { OR: [{ teamId: null }, { team: { members: { some: { userId: user.id } } } }] },
        ],
      },
    ],
  }
}

/** Та же логика для одной очереди — для проверок перед изменением. */
export function canSeeQueue(
  user: SessionUser,
  queue: { ownerId: string; teams?: { members: { userId: string }[] }[] },
): boolean {
  if (seesEveryQueue(user)) return true
  if (queue.ownerId === user.id) return true
  return (queue.teams ?? []).some((t) => t.members.some((m) => m.userId === user.id))
}

/**
 * Видна ли человеку конкретная задача.
 *
 * Повторяет правило taskScope для одной уже загруженной записи: либо
 * задача его собственная, либо очередь открыта его команде и задача не
 * отдана чужой. Проверка по одной очереди этого не учитывала, и
 * назначенная задача, найденная в списке, отвечала «не найдена» при
 * открытии.
 */
export function canSeeTask(
  user: SessionUser,
  task: {
    queue: { ownerId: string; teams?: { members: { userId: string }[] }[] }
    assigneeId?: string | null
    authorId?: string
    watchers?: { userId: string }[]
    teamId?: string | null
    team?: { members: { userId: string }[] } | null
  },
): boolean {
  // Своё — всегда, никакие ограничения этого не отменяют.
  if (task.assigneeId === user.id) return true
  if (task.authorId === user.id) return true
  if ((task.watchers ?? []).some((w) => w.userId === user.id)) return true
  if ((task.team?.members ?? []).some((m) => m.userId === user.id)) return true

  if (seesEveryQueue(user)) return true
  if (!canSeeQueue(user, task.queue)) return false

  // Задача, поручённая команде, видна только её участникам.
  if (task.teamId) return false
  return true
}

/** Условие видимости для выборок по очередям. */
export function queueScope(user: SessionUser): Prisma.QueueWhereInput {
  if (seesEveryQueue(user)) return {}
  return reachableQueue(user)
}

/**
 * Условие видимости для выборок по проектам.
 *
 * Проект открывается командам — так же, как очередь. Пустой список
 * команд означает «никому»: доступ выдаётся явно, а не подразумевается.
 */
export function projectScope(user: SessionUser): Prisma.ProjectWhereInput {
  if (user.role === 'admin') return {}

  // Лид координирует работу, поэтому видит все проекты организации.
  if (user.role === 'manager') return {}

  /*
   * Участник и гость видят проект, только если он им открыт.
   *
   * Прежде видимость выводилась из задач: есть в проекте своя задача —
   * значит, проект виден. Правило ошибалось в обе стороны. Человеку с
   * одной задачей доставалась карточка чужого проекта целиком — цель,
   * описание, руководитель, срок, доля выполненного; а тот, кого в
   * проект только собираются привлечь, не видел ничего, пока ему не
   * заведут задачу.
   *
   * Теперь доступ выдаётся явно — командам, как и у очереди. Это тот же
   * порядок, что владелец завёл для очередей, и одно правило на весь
   * трекер понятнее двух разных.
   *
   * Доступ к очереди здесь не проверяется намеренно. Иначе выданный
   * доступ мог бы молча не сработать — а разрешение, которое не
   * действует и об этом не говорит, хуже отсутствующего. Задачи внутри
   * проекта всё равно отбираются своей проверкой: открытый проект не
   * показывает задач из закрытой очереди.
   */
  return {
    OR: [
      // Руководитель проекта видит его всегда: он за него и отвечает.
      { leadId: user.id },
      { teams: { some: { members: { some: { userId: user.id } } } } },
    ],
  }
}

/**
 * Условие поиска задачи по ключу с учётом видимости.
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
