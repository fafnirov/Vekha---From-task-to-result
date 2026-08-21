/** Domain model for the Vekha tracker. */

export type StatusName =
  | 'New'
  | 'Open'
  | 'In Progress'
  | 'Review'
  | 'Testing'
  | 'Done'
  | 'Blocked'

export type PriorityName = 'Critical' | 'High' | 'Medium' | 'Low'

/** Short code used everywhere as an avatar/assignee reference. */
export type PersonId = 'AK' | 'DS' | 'MN' | 'IV' | 'EL' | 'PG'

export interface Person {
  id: PersonId
  /** Two-letter monogram shown in avatars. */
  who: string
  name: string
  role: string
  bg: string
  fg: string
}

export interface StatusStyle {
  bg: string
  fg: string
  dot: string
}

export interface PriorityStyle {
  icon: string
  fg: string
  bg: string
  glyph: string
}

/** Deadline colouring: overdue, due today, or neutral. */
export type DueState = 'over' | 'today' | undefined

export interface Task {
  key: string
  title: string
  status: StatusName
  priority: PriorityName
  who: PersonId
  project: string
  queue: string
  sprint: string
  due: string
  est: number
  tags: string[]
  dueState?: DueState
}

export interface Project {
  name: string
  abbr: string
  bg: string
  fg: string
  done: number
  total: number
  pct: string
  due: string
  lead: PersonId
  queue: string
  state: string
  stBg: string
  stFg: string
  /** Nearest upcoming milestone, shown on the dashboard card. */
  milestone: string
  atRisk?: boolean
}

export interface Queue {
  key: string
  name: string
  owner: PersonId
  n: number
  wf: string
  access: string
  accBg: string
  accFg: string
}

export interface Team {
  abbr: string
  name: string
  note: string
  load: string
  bg: string
  fg: string
  members: { id: PersonId; tasks: number }[]
}

export interface Transition {
  from: StatusName
  to: StatusName
  cond: string
  role: string
}

export interface TaskField {
  id: string
  label: string
  type: string
  icon: string
  screen: string
  req: boolean
  card: boolean
}

export interface Permission {
  id: string
  label: string
  cells: boolean[]
}

export interface AutomationRule {
  id: string
  name: string
  trigger: string
  cond: string
  action: string
  runs: string
  icon: string
  iconFg: string
  on: boolean
}

export interface TaskTemplate {
  name: string
  icon: string
  note: string
  tags: string[]
}

export interface Milestone {
  title: string
  note: string
  date: string
  state: string
  icon: string
  bg: string
  fg: string
  dateFg: string
}

export interface GanttRow {
  label: string
  start: number
  dur: number
  pct: string
  c: string
  who: PersonId | ''
  dates: string
  phase?: boolean
  milestone?: boolean
  dep?: boolean
  status?: StatusName
}

export interface ToastItem {
  id: number
  title: string
  text: string
  kind: ToastKind
}

export type ToastKind = 'ok' | 'info' | 'warn' | 'err'

export interface FilterCondition {
  field: string
  op: string
  icon: string
  values: string[]
  vbg: string
  vfg: string
}

export interface SavedFilter {
  label: string
  n: number
  icon: string
  icf: string
}

export type ScreenId =
  | 'home'
  | 'tasks'
  | 'task'
  | 'board'
  | 'backlog'
  | 'queues'
  | 'projects'
  | 'project'
  | 'filters'
  | 'reports'
  | 'teams'
  | 'workflow'
