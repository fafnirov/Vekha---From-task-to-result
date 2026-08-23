import type {
  PriorityName,
  PriorityStyle,
  StatusCategory,
  StatusName,
  StatusStyle,
} from './types'

/**
 * Визуальные словари дизайн-системы. Содержимое приходит из API,
 * а цвет и иконка выбираются здесь — так тема остаётся заботой клиента.
 */

/** Палитра по категории статуса: работает и для статусов, добавленных в настройках. */
export const ST_BY_CATEGORY: Record<StatusCategory, StatusStyle> = {
  todo: { bg: 'var(--info-bg)', fg: 'var(--info)', dot: 'var(--info)' },
  inprogress: { bg: 'var(--ac-soft)', fg: 'var(--ac-tx)', dot: 'var(--ac)' },
  done: { bg: 'var(--ok-bg)', fg: 'var(--ok)', dot: 'var(--ok)' },
  blocked: { bg: 'var(--dang-bg)', fg: 'var(--dang)', dot: 'var(--dang)' },
}

/** Уточнения для статусов из стандартного набора. */
export const ST: Record<string, StatusStyle> = {
  New: { bg: 'var(--n-bg)', fg: 'var(--tx2)', dot: 'var(--tx3)' },
  Open: ST_BY_CATEGORY.todo,
  'In Progress': ST_BY_CATEGORY.inprogress,
  Review: { bg: 'var(--warn-bg)', fg: 'var(--warn)', dot: 'var(--warn)' },
  Testing: { bg: 'var(--vio-bg)', fg: 'var(--vio)', dot: 'var(--vio)' },
  Done: ST_BY_CATEGORY.done,
  Blocked: ST_BY_CATEGORY.blocked,
}

export const PR: Record<PriorityName, PriorityStyle> = {
  Critical: {
    icon: 'keyboard_double_arrow_up',
    fg: 'var(--dang)',
    bg: 'var(--dang-bg)',
    glyph: '⇈',
  },
  High: {
    icon: 'keyboard_arrow_up',
    fg: 'var(--warn)',
    bg: 'var(--warn-bg)',
    glyph: '↑',
  },
  Medium: { icon: 'remove', fg: 'var(--info)', bg: 'var(--info-bg)', glyph: '—' },
  Low: {
    icon: 'keyboard_arrow_down',
    fg: 'var(--tx3)',
    bg: 'var(--n-bg)',
    glyph: '↓',
  },
}

export const PRIORITY_NAMES: PriorityName[] = ['Critical', 'High', 'Medium', 'Low']

export const PRIORITY_KEY: Record<PriorityName, 'critical' | 'high' | 'medium' | 'low'> = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
}

export const PRIORITY_ORDER: Record<PriorityName, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
}

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Админ',
  manager: 'Лид',
  member: 'Участник',
  viewer: 'Гость',
}

export function statusStyle(status: StatusName, category?: StatusCategory): StatusStyle {
  return ST[status] ?? (category ? ST_BY_CATEGORY[category] : undefined) ?? ST.New
}

export function priorityStyle(p: PriorityName): PriorityStyle {
  return PR[p] ?? PR.Medium
}

/** Цвет дедлайна следует состоянию, а не самой дате. */
export function dueColor(state: 'over' | 'today' | undefined): string {
  if (state === 'over') return 'var(--dang)'
  if (state === 'today') return 'var(--warn)'
  return 'var(--tx2)'
}

/** Ярлык размера файла для списка вложений. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}
