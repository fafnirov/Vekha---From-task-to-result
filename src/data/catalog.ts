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
  Новая: { bg: 'var(--n-bg)', fg: 'var(--tx2)', dot: 'var(--tx3)' },
  Открыта: ST_BY_CATEGORY.todo,
  'В работе': ST_BY_CATEGORY.inprogress,
  'На проверке': { bg: 'var(--warn-bg)', fg: 'var(--warn)', dot: 'var(--warn)' },
  Тестирование: { bg: 'var(--vio-bg)', fg: 'var(--vio)', dot: 'var(--vio)' },
  Готово: ST_BY_CATEGORY.done,
  Заблокирована: ST_BY_CATEGORY.blocked,
}

export const PR: Record<PriorityName, PriorityStyle> = {
  Критический: {
    icon: 'keyboard_double_arrow_up',
    fg: 'var(--dang)',
    bg: 'var(--dang-bg)',
    glyph: '⇈',
  },
  Высокий: {
    icon: 'keyboard_arrow_up',
    fg: 'var(--warn)',
    bg: 'var(--warn-bg)',
    glyph: '↑',
  },
  Средний: { icon: 'remove', fg: 'var(--info)', bg: 'var(--info-bg)', glyph: '—' },
  Низкий: {
    icon: 'keyboard_arrow_down',
    fg: 'var(--tx3)',
    bg: 'var(--n-bg)',
    glyph: '↓',
  },
}

export const PRIORITY_NAMES: PriorityName[] = ['Критический', 'Высокий', 'Средний', 'Низкий']

export const PRIORITY_KEY: Record<PriorityName, 'critical' | 'high' | 'medium' | 'low'> = {
  Критический: 'critical',
  Высокий: 'high',
  Средний: 'medium',
  Низкий: 'low',
}

export const PRIORITY_ORDER: Record<PriorityName, number> = {
  Критический: 0,
  Высокий: 1,
  Средний: 2,
  Низкий: 3,
}

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Админ',
  manager: 'Лид',
  member: 'Участник',
  viewer: 'Гость',
}

export function statusStyle(status: StatusName, category?: StatusCategory): StatusStyle {
  return ST[status] ?? (category ? ST_BY_CATEGORY[category] : undefined) ?? ST.Новая
}

export function priorityStyle(p: PriorityName): PriorityStyle {
  return PR[p] ?? PR.Средний
}

/** Цвет срока следует состоянию, а не самой дате. */
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

/**
 * Склонение существительного при числе: 1 балл, 2 балла, 5 баллов.
 *
 * Раньше на месте баллов стояло «SP» — сокращение от story points.
 * Английское сокращение в русском интерфейсе ничего не объясняет тому,
 * кто не знает жаргона, а знающему не нужно.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/** «3 балла» — оценка задачи словами. */
export function points(n: number): string {
  return `${n} ${plural(n, 'балл', 'балла', 'баллов')}`
}

/** Категория статуса словами — в настройках и подсказках. */
export const CATEGORY_LABEL: Record<string, string> = {
  todo: 'к выполнению',
  inprogress: 'в работе',
  done: 'завершено',
  blocked: 'заблокировано',
}
