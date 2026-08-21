import type { PersonId } from './types'

export interface Notification {
  who: PersonId
  text: string
  key: string
  time: string
  unread: boolean
}

export const NOTIFICATIONS: Notification[] = [
  {
    who: 'MN',
    text: 'Марина упомянула вас в комментарии',
    key: 'VEKHA-142',
    time: '9 мин',
    unread: true,
  },
  {
    who: 'DS',
    text: 'Дмитрий перевёл задачу в Review',
    key: 'VEKHA-138',
    time: '48 мин',
    unread: true,
  },
  {
    who: 'PG',
    text: 'Павел добавил связь «блокирует»',
    key: 'LMS-23',
    time: '2 ч',
    unread: false,
  },
  {
    who: 'EL',
    text: 'Елена запросила доступ к очереди SEC',
    key: 'SEC-12',
    time: 'вчера',
    unread: false,
  },
]

export interface Mention {
  who: PersonId
  kind: string
  icon: string
  icFg: string
  key: string
  time: string
  text: string
  unread: boolean
}

export const MENTIONS: Mention[] = [
  {
    who: 'MN',
    kind: 'упоминание',
    icon: 'alternate_email',
    icFg: 'var(--ac)',
    key: 'VEKHA-142',
    time: '9 мин',
    text: 'Аня, свёрнутое меню на 13" теряет смысл без подписей — посмотри третий вариант.',
    unread: true,
  },
  {
    who: 'DS',
    kind: 'комментарий',
    icon: 'chat',
    icFg: 'var(--tx3)',
    key: 'VEKHA-141',
    time: '31 мин',
    text: 'Сортировка ломается только при переключении представления — воспроизвёл, чиню.',
    unread: true,
  },
  {
    who: 'PG',
    kind: 'блокировка',
    icon: 'block',
    icFg: 'var(--dang)',
    key: 'LMS-23',
    time: '2 ч',
    text: 'Партнёр не отдаёт список групп по API, ждём ответа до конца недели.',
    unread: true,
  },
  {
    who: 'EL',
    kind: 'ревью',
    icon: 'rate_review',
    icFg: 'var(--warn)',
    key: 'SEC-12',
    time: 'вчера',
    text: 'Аудит прав закончен, два замечания по гостевому доступу — нужен твой вердикт.',
    unread: false,
  },
]

export interface ActivityItem {
  who: string
  what: string
  key: string
  time: string
  icon: string
  bg: string
  fg: string
}

export const ACTIVITY: ActivityItem[] = [
  {
    who: 'Дмитрий Соколов',
    what: 'перевёл задачу в Review',
    key: 'VEKHA-138',
    time: '48 мин',
    icon: 'sync_alt',
    bg: 'var(--ac-soft)',
    fg: 'var(--ac-tx)',
  },
  {
    who: 'Марина Нестерова',
    what: 'добавила вложение sidebar-states.png',
    key: 'VEKHA-142',
    time: '1 ч',
    icon: 'attach_file',
    bg: 'var(--n-bg)',
    fg: 'var(--tx2)',
  },
  {
    who: 'Автоматизация',
    what: 'подняла приоритет просроченной задачи',
    key: 'LMS-23',
    time: '2 ч',
    icon: 'bolt',
    bg: 'var(--vio-bg)',
    fg: 'var(--vio)',
  },
  {
    who: 'Игорь Волков',
    what: 'взял задачу в работу',
    key: 'MOB-84',
    time: '3 ч',
    icon: 'play_arrow',
    bg: 'var(--info-bg)',
    fg: 'var(--info)',
  },
  {
    who: 'Анна Ковалёва',
    what: 'закрыла задачу',
    key: 'VEKHA-136',
    time: 'вчера',
    icon: 'task_alt',
    bg: 'var(--ok-bg)',
    fg: 'var(--ok)',
  },
]

export interface Comment {
  id: string
  who: PersonId
  time: string
  badge?: string
  text: string
  fresh?: boolean
}

export const BASE_COMMENTS: Comment[] = [
  {
    id: 'b1',
    who: 'DS',
    time: 'вчера, 18:24',
    text: 'Проверил старую карту разделов: 14 пунктов, из них 4 ведут на один и тот же список. Предлагаю оставить восемь и вынести администрирование вниз.',
  },
  {
    id: 'b2',
    who: 'MN',
    time: 'сегодня, 09:12',
    badge: 'дизайн',
    text: 'Собрала три варианта левого меню. Свёрнутое состояние нужно проверить на 13-дюймовых экранах — иконки без подписей теряют смысл для новых пользователей.',
  },
  {
    id: 'b3',
    who: 'PG',
    time: 'сегодня, 10:05',
    text: 'Учтите права: разделы «Автоматизации» и «Настройки» видны только администраторам очереди, у остальных они должны скрываться, а не блокироваться.',
  },
]

export interface HistoryItem {
  who: string
  what: string
  from?: string
  to?: string
  toBg?: string
  toFg?: string
  time: string
  icon: string
  bg: string
  fg: string
}

export const TASK_HISTORY: HistoryItem[] = [
  {
    who: 'Анна Ковалёва',
    what: 'изменила статус',
    from: 'Open',
    to: 'In Progress',
    toBg: 'var(--ac-soft)',
    toFg: 'var(--ac-tx)',
    time: 'сегодня, 09:02',
    icon: 'sync_alt',
    bg: 'var(--ac-soft)',
    fg: 'var(--ac-tx)',
  },
  {
    who: 'Марина Нестерова',
    what: 'добавила вложение sidebar-states.png',
    time: 'сегодня, 08:41',
    icon: 'attach_file',
    bg: 'var(--n-bg)',
    fg: 'var(--tx2)',
  },
  {
    who: 'Дмитрий Соколов',
    what: 'изменил приоритет',
    from: 'Medium',
    to: 'High',
    toBg: 'var(--warn-bg)',
    toFg: 'var(--warn)',
    time: 'вчера, 18:30',
    icon: 'flag',
    bg: 'var(--warn-bg)',
    fg: 'var(--warn)',
  },
  {
    who: 'Анна Ковалёва',
    what: 'установила оценку 5 SP',
    time: 'вчера, 15:10',
    icon: 'straighten',
    bg: 'var(--info-bg)',
    fg: 'var(--info)',
  },
  {
    who: 'Павел Гущин',
    what: 'добавил связь «блокирует VEKHA-138»',
    time: '14 августа',
    icon: 'link',
    bg: 'var(--n-bg)',
    fg: 'var(--tx2)',
  },
  {
    who: 'Анна Ковалёва',
    what: 'создала задачу в очереди VEKHA',
    time: '12 августа',
    icon: 'add',
    bg: 'var(--ok-bg)',
    fg: 'var(--ok)',
  },
]

export const EVENT_HISTORY: HistoryItem[] = [
  {
    who: 'Дмитрий Соколов',
    what: 'оставил комментарий: «Проверил старую карту разделов…»',
    time: 'вчера, 18:24',
    icon: 'chat',
    bg: 'var(--ac-soft)',
    fg: 'var(--ac-tx)',
  },
  {
    who: 'Марина Нестерова',
    what: 'оставила комментарий: «Собрала три варианта левого меню…»',
    time: 'сегодня, 09:12',
    icon: 'chat',
    bg: 'var(--ac-soft)',
    fg: 'var(--ac-tx)',
  },
  {
    who: 'Автоматизация',
    what: 'уведомила ревьюера по правилу «Перевод в Review»',
    time: 'сегодня, 09:03',
    icon: 'bolt',
    bg: 'var(--vio-bg)',
    fg: 'var(--vio)',
  },
]

export type AttentionKind =
  | 'overdue'
  | 'blocked'
  | 'today'
  | 'soon'
  | 'mention'
  | 'review'
  | 'noassignee'

export interface AttentionRow {
  key: string
  kind: AttentionKind
  meta: string
}

/** Rows of the "Требует внимания" list on the dashboard. */
export const ATTENTION: AttentionRow[] = [
  { key: 'LMS-23', kind: 'blocked', meta: '2 дня' },
  { key: 'VEKHA-141', kind: 'today', meta: 'сегодня' },
  { key: 'VEKHA-138', kind: 'review', meta: '48 мин' },
  { key: 'SEC-9', kind: 'noassignee', meta: '8 сен' },
  { key: 'REL-22', kind: 'soon', meta: '24 авг' },
  { key: 'MOB-84', kind: 'mention', meta: '3 ч' },
]

export const ATTENTION_REASONS: Record<
  AttentionKind,
  { reason: string; icon: string; bg: string; fg: string; bar: string }
> = {
  overdue: {
    reason: 'просрочено',
    icon: 'schedule',
    bg: 'var(--dang-bg)',
    fg: 'var(--dang)',
    bar: 'var(--dang)',
  },
  blocked: {
    reason: 'blocked',
    icon: 'block',
    bg: 'var(--dang-bg)',
    fg: 'var(--dang)',
    bar: 'var(--dang)',
  },
  today: {
    reason: 'дедлайн сегодня',
    icon: 'today',
    bg: 'var(--warn-bg)',
    fg: 'var(--warn)',
    bar: 'var(--warn)',
  },
  soon: {
    reason: 'дедлайн через 2 дня',
    icon: 'event',
    bg: 'var(--warn-bg)',
    fg: 'var(--warn)',
    bar: 'var(--warn)',
  },
  mention: {
    reason: 'упоминание',
    icon: 'alternate_email',
    bg: 'var(--ac-soft)',
    fg: 'var(--ac-tx)',
    bar: 'var(--ac)',
  },
  review: {
    reason: 'ждёт решения',
    icon: 'rate_review',
    bg: 'var(--ac-soft)',
    fg: 'var(--ac-tx)',
    bar: 'var(--ac)',
  },
  noassignee: {
    reason: 'без исполнителя',
    icon: 'person_off',
    bg: 'var(--n-bg)',
    fg: 'var(--tx2)',
    bar: 'var(--border2)',
  },
}
