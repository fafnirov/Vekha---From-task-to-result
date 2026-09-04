/** Словари домена. Единственный источник правды для ролей и прав. */

export const ROLES = ['admin', 'manager', 'member', 'viewer'] as const
export type Role = (typeof ROLES)[number]

/** Чем больше число, тем больше полномочий. Используется для сравнений. */
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3,
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Админ',
  manager: 'Руководитель',
  member: 'Участник',
  viewer: 'Гость',
}

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

/** Показываемые имена приоритетов. */
export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: 'Критический',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}

/**
 * Разбор имени приоритета. Английские написания оставлены нарочно:
 * по ним могли быть сохранены фильтры и правила автоматизации, и
 * переименование не должно их ломать.
 */
export const PRIORITY_FROM_LABEL: Record<string, Priority> = {
  Критический: 'critical',
  Высокий: 'high',
  Средний: 'medium',
  Низкий: 'low',
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export const STATUS_CATEGORIES = ['todo', 'inprogress', 'done', 'blocked'] as const
export type StatusCategory = (typeof STATUS_CATEGORIES)[number]

export const PROJECT_STATES = ['planned', 'active', 'risk', 'release', 'done'] as const

export const PROJECT_STATE_LABEL: Record<string, string> = {
  planned: 'запланирован',
  active: 'в работе',
  risk: 'риск',
  release: 'выпуск',
  done: 'завершён',
}

export const LINK_TYPES = ['blocks', 'relates', 'duplicates', 'causes'] as const

export const LINK_LABEL: Record<string, string> = {
  blocks: 'блокирует',
  relates: 'связана с',
  duplicates: 'дублирует',
  causes: 'вызывает',
}

export const LINK_INVERSE_LABEL: Record<string, string> = {
  blocks: 'заблокирована задачей',
  relates: 'связана с',
  duplicates: 'дублируется задачей',
  causes: 'вызвана задачей',
}

/* ── Права ────────────────────────────────────────────────────────────── */

/**
 * Матрица прав из экрана настроек. Порядок совпадает с колонками таблицы,
 * а `key` — с проверками в маршрутах.
 */
export const PERMISSION_KEYS = [
  { key: 'task.view', label: 'Просмотр задач' },
  { key: 'task.create', label: 'Создание задач' },
  { key: 'task.status', label: 'Изменение статуса' },
  { key: 'task.editForeign', label: 'Редактирование чужих задач' },
  { key: 'sprint.manage', label: 'Управление спринтами' },
  { key: 'workflow.manage', label: 'Настройка схемы' },
  { key: 'task.delete', label: 'Удаление задач' },
  { key: 'people.manage', label: 'Управление участниками' },
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]['key']

/* ── Разделы приложения ───────────────────────────────────────────────── */

/**
 * Разделы бокового меню. Администратор решает, какие из них показывать
 * какой роли.
 *
 * Это настройка вида, а не доступа: спрятанный раздел убирает пункт из
 * меню и закрывает страницу, но данные по-прежнему защищают права и
 * доступ команд к очередям. Показать гостю «Отчёты» не значит открыть
 * ему чужие задачи — он увидит там только то, что ему и так доступно.
 */
export const SECTION_KEYS = [
  { key: 'home', label: 'Главная', path: '/' },
  { key: 'tasks', label: 'Задачи', path: '/tasks' },
  { key: 'queues', label: 'Очереди', path: '/queues' },
  { key: 'projects', label: 'Проекты', path: '/projects' },
  { key: 'board', label: 'Доски', path: '/board' },
  { key: 'sprints', label: 'Спринты', path: '/backlog' },
  { key: 'filters', label: 'Фильтры', path: '/filters' },
  { key: 'reports', label: 'Отчёты', path: '/reports' },
  { key: 'teams', label: 'Команды', path: '/teams' },
  { key: 'settings', label: 'Настройки', path: '/workflow' },
] as const

export type SectionKey = (typeof SECTION_KEYS)[number]['key']

/**
 * Что видит роль по умолчанию.
 *
 * Гостю оставлены только просмотровые разделы: он смотрит, а не ведёт
 * работу. Участнику закрыты настройки — там раздаются права, и место
 * это не его.
 */
export const DEFAULT_SECTIONS: Record<string, Role[]> = {
  home: ['admin', 'manager', 'member', 'viewer'],
  tasks: ['admin', 'manager', 'member', 'viewer'],
  queues: ['admin', 'manager', 'member'],
  projects: ['admin', 'manager', 'member'],
  board: ['admin', 'manager', 'member', 'viewer'],
  sprints: ['admin', 'manager', 'member'],
  filters: ['admin', 'manager', 'member'],
  reports: ['admin', 'manager'],
  teams: ['admin', 'manager'],
  settings: ['admin'],
}

/** Значения по умолчанию, которыми заполняется таблица RolePermission. */
export const DEFAULT_PERMISSIONS: Record<string, Role[]> = {
  'task.view': ['admin', 'manager', 'member', 'viewer'],
  'task.create': ['admin', 'manager', 'member'],
  'task.status': ['admin', 'manager', 'member'],
  'task.editForeign': ['admin', 'manager'],
  'sprint.manage': ['admin', 'manager'],
  'workflow.manage': ['admin'],
  'task.delete': ['admin'],
  'people.manage': ['admin'],
}

/* ── Палитра аватаров ─────────────────────────────────────────────────── */

/** Пары «фон / текст» из дизайн-системы, раздаются новым участникам по кругу. */
export const AVATAR_PALETTE = [
  { bg: 'var(--ac-soft2)', fg: 'var(--ac-tx)' },
  { bg: 'var(--info-bg)', fg: 'var(--info)' },
  { bg: 'var(--vio-bg)', fg: 'var(--vio)' },
  { bg: 'var(--ok-bg)', fg: 'var(--ok)' },
  { bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  { bg: 'var(--n-bg)', fg: 'var(--tx2)' },
]

export const PROJECT_PALETTE = [
  { bg: 'var(--ac-soft2)', fg: 'var(--ac)' },
  { bg: 'var(--info-bg)', fg: 'var(--info)' },
  { bg: 'var(--vio-bg)', fg: 'var(--vio)' },
  { bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  { bg: 'var(--ok-bg)', fg: 'var(--ok)' },
  { bg: 'var(--n-bg)', fg: 'var(--tx2)' },
]

export const PROJECT_STATE_STYLE: Record<string, { bg: string; fg: string }> = {
  planned: { bg: 'var(--n-bg)', fg: 'var(--tx2)' },
  active: { bg: 'var(--ac-soft)', fg: 'var(--ac-tx)' },
  risk: { bg: 'var(--dang-bg)', fg: 'var(--dang)' },
  release: { bg: 'var(--ok-bg)', fg: 'var(--ok)' },
  done: { bg: 'var(--ok-bg)', fg: 'var(--ok)' },
}

export const CATEGORY_COLOR: Record<string, string> = {
  todo: 'var(--info)',
  inprogress: 'var(--ac)',
  done: 'var(--ok)',
  blocked: 'var(--dang)',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
