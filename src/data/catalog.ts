import type {
  Person,
  PersonId,
  PriorityName,
  PriorityStyle,
  StatusName,
  StatusStyle,
} from './types'

/** Status palette. Every badge, dot and column header reads from here. */
export const ST: Record<StatusName, StatusStyle> = {
  New: { bg: 'var(--n-bg)', fg: 'var(--tx2)', dot: 'var(--tx3)' },
  Open: { bg: 'var(--info-bg)', fg: 'var(--info)', dot: 'var(--info)' },
  'In Progress': { bg: 'var(--ac-soft)', fg: 'var(--ac-tx)', dot: 'var(--ac)' },
  Review: { bg: 'var(--warn-bg)', fg: 'var(--warn)', dot: 'var(--warn)' },
  Testing: { bg: 'var(--vio-bg)', fg: 'var(--vio)', dot: 'var(--vio)' },
  Done: { bg: 'var(--ok-bg)', fg: 'var(--ok)', dot: 'var(--ok)' },
  Blocked: { bg: 'var(--dang-bg)', fg: 'var(--dang)', dot: 'var(--dang)' },
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

export const PEOPLE: Record<PersonId, Person> = {
  AK: {
    id: 'AK',
    who: 'АК',
    name: 'Анна Ковалёва',
    role: 'Product Lead',
    bg: 'var(--ac-soft2)',
    fg: 'var(--ac-tx)',
  },
  DS: {
    id: 'DS',
    who: 'ДС',
    name: 'Дмитрий Соколов',
    role: 'Backend',
    bg: 'var(--info-bg)',
    fg: 'var(--info)',
  },
  MN: {
    id: 'MN',
    who: 'МН',
    name: 'Марина Нестерова',
    role: 'Design',
    bg: 'var(--vio-bg)',
    fg: 'var(--vio)',
  },
  IV: {
    id: 'IV',
    who: 'ИВ',
    name: 'Игорь Волков',
    role: 'Mobile',
    bg: 'var(--ok-bg)',
    fg: 'var(--ok)',
  },
  EL: {
    id: 'EL',
    who: 'ЕЛ',
    name: 'Елена Лапина',
    role: 'QA / Security',
    bg: 'var(--warn-bg)',
    fg: 'var(--warn)',
  },
  PG: {
    id: 'PG',
    who: 'ПГ',
    name: 'Павел Гущин',
    role: 'Integrations',
    bg: 'var(--n-bg)',
    fg: 'var(--tx2)',
  },
}

/** The canonical order a task moves through. */
export const STATUS_FLOW: StatusName[] = [
  'New',
  'Open',
  'In Progress',
  'Review',
  'Testing',
  'Done',
]

export const PRIORITY_ORDER: Record<PriorityName, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
}

export const CURRENT_USER: PersonId = 'AK'

export const ORG = {
  name: 'Норд Софт',
  unit: 'Продуктовая команда',
  mark: 'Н',
  version: '2.4',
}

export function person(id: PersonId): Person {
  return PEOPLE[id]
}

export function statusStyle(s: StatusName): StatusStyle {
  return ST[s] ?? ST.New
}

export function priorityStyle(p: PriorityName): PriorityStyle {
  return PR[p] ?? PR.Medium
}

/** Deadline colour follows the task's due state, not the date string. */
export function dueColor(state: DueStateLike): string {
  if (state === 'over') return 'var(--dang)'
  if (state === 'today') return 'var(--warn)'
  return 'var(--tx2)'
}

type DueStateLike = 'over' | 'today' | undefined
