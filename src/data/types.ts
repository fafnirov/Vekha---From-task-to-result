/**
 * Доменная модель клиента. Типы повторяют то, что отдаёт API
 * (см. server/lib/dto.ts): сервер уже приводит даты к подписям вида
 * «28 авг» и подставляет переменные дизайн-системы, поэтому экранам
 * остаётся только раскладка.
 */

/** Имена статусов задаются в настройках воркфлоу, поэтому это строка. */
export type StatusName = string

/** Категория статуса — она же определяет цвет и попадание в отчёты. */
export type StatusCategory = 'todo' | 'inprogress' | 'done' | 'blocked'

export type PriorityName = 'Критический' | 'Высокий' | 'Средний' | 'Низкий'
export type PriorityKey = 'critical' | 'high' | 'medium' | 'low'

/** Короткий код участника: им задача ссылается на человека. */
export type PersonId = string

export type AccessRole = 'admin' | 'manager' | 'member' | 'viewer'

export interface Person {
  id: string
  code: PersonId
  /** Монограмма для аватара. */
  who: string
  name: string
  /** Должность. */
  role: string
  accessRole: AccessRole
  email: string
  bg: string
  fg: string
  active: boolean
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

export type DueState = 'over' | 'today' | undefined

export interface Task {
  id: string
  key: string
  num: number
  title: string
  description: string
  status: StatusName
  statusId: string
  statusCategory: StatusCategory
  type: string | null
  typeId: string | null
  typeIcon: string
  typeColor: string
  isEpic: boolean
  resolution: string | null
  resolutionId: string | null
  resolutionKind: string | null
  priority: PriorityName
  priorityKey: PriorityKey
  who: PersonId | null
  assigneeId: string | null
  authorCode: PersonId
  authorId: string
  project: string
  projectId: string | null
  /** Команда, которой поручена задача. Задана — видит только она. */
  team: string | null
  teamId: string | null
  teamAbbr: string | null
  teamBg: string | null
  teamFg: string | null
  queue: string
  queueId: string
  sprint: string
  sprintId: string | null
  parentKey: string | null
  due: string
  dueDate: string | null
  dueState: DueState
  est: number
  tags: string[]
  rank: number
  createdAt: string
  updatedAt: string
  closedAt: string | null
  comments: number
  attachments: number
  subtasks: number
}

export interface TaskPage {
  items: Task[]
  total: number
  page: number
  perPage: number
  pages: number
}

export interface WorklogEntry {
  id: string
  minutes: number
  note: string
  who: PersonId
  whoName: string
  spentOn: string
  day: string
}

export interface TaskDetail {
  task: Task
  subtasks: Task[]
  watchers: { id: string; code: PersonId; name: string }[]
  links: {
    id: string
    type: string
    label: string
    direction: 'in' | 'out'
    task: Task
  }[]
  attachments: {
    id: string
    filename: string
    size: number
    mime: string
    by: PersonId
    byName: string
    url: string
    createdAt: string
  }[]
  worklog: {
    total: number
    items: WorklogEntry[]
  }
  transitions: {
    id: string
    to: StatusName
    category: StatusCategory
    condition: string
    role: string
  }[]
}

export interface TaskType {
  id: string
  name: string
  icon: string
  color: string
  epic: boolean
  system: boolean
  n: number
}

export interface Resolution {
  id: string
  name: string
  /** success | neutral | rejected — влияет на цвет и на отчёты. */
  kind: string
  system: boolean
  n: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
  who: PersonId | null
  whoName: string | null
  due: string
  dueDate: string | null
  /** Ключ задачи, в которую пункт был превращён. */
  spawnedKey: string | null
  order: number
}

export interface Queue {
  id: string
  key: string
  name: string
  owner: PersonId
  ownerId: string
  n: number
  /** Счётчик нумерации: следующая задача получит номер counter + 1. */
  counter: number
  wf: string
  workflowId: string
  /** Команды, которым открыта очередь. Пусто — только админы и лиды. */
  teams: { id: string; name: string; abbr: string; bg: string; fg: string }[]
  open: boolean
}

export interface Project {
  id: string
  name: string
  abbr: string
  description: string
  bg: string
  fg: string
  done: number
  total: number
  pct: string
  due: string
  dueDate: string | null
  startDate: string | null
  lead: PersonId
  leadId: string
  queue: string
  queueId: string
  state: string
  stateKey: string
  stBg: string
  stFg: string
  milestone: string
  atRisk: boolean
}

export interface Milestone {
  id: string
  title: string
  note: string
  date: string
  dateISO: string
  state: string
  stateKey: string
  icon: string
  bg: string
  fg: string
  dateFg: string
}

export interface GanttRow {
  label: string
  key?: string
  start: number
  dur: number
  pct: string
  c: string
  who: PersonId | ''
  dates: string
  status?: StatusName
  milestone?: boolean
}

export interface ProjectDetail {
  project: Project
  tasks: Task[]
  milestones: Milestone[]
  gantt: GanttRow[]
  ganttHeader: string[]
  risks: { title: string; note: string; level: 'high' | 'medium' | 'low' }[]
}

export interface Sprint {
  id: string
  name: string
  queue: string
  queueId: string
  goal: string
  state: 'planned' | 'active' | 'closed'
  capacity: number
  startDate: string
  endDate: string
  range: string
  tasks: number
  points: number
  donePoints: number
}

export interface PlanningPerson extends Person {
  points: number
  done: number
  capacity: number
  overloaded: boolean
  load: number
}

export interface Planning {
  sprint: Sprint | null
  sprintTasks: Task[]
  backlog: Task[]
  people: PlanningPerson[]
  summary: {
    planned: number
    capacity: number
    free: number
    over: number
    tasks: number
    unassigned: number
    unestimated: number
  }
  sprints: Sprint[]
}

export interface BoardColumn {
  id: string
  name: string
  statuses: StatusName[]
  wipLimit: number
  keys: string[]
}

export interface Board {
  columns: BoardColumn[]
  tasks: Record<string, Task>
}

export interface Team {
  id: string
  name: string
  abbr: string
  note: string
  bg: string
  fg: string
  tasks: number
  load: string
  members: (Person & { teamRole: string; tasks: number })[]
}

export interface Comment {
  id: string
  who: PersonId
  authorId: string
  time: string
  createdAt: string
  text: string
  edited: boolean
}

export interface HistoryItem {
  id: string
  who: string
  whoCode: PersonId | null
  what: string
  from?: string
  to?: string
  toBg?: string
  toFg?: string
  key: string
  time: string
  createdAt: string
  kind: string
  icon: string
  bg: string
  fg: string
}

export interface ActivityItem {
  id: string
  who: string
  what: string
  key: string
  time: string
  icon: string
  bg: string
  fg: string
}

export interface Notification {
  id: string
  who: PersonId | null
  text: string
  key: string
  time: string
  createdAt: string
  unread: boolean
  kind: string
  kindKey: string
  icon: string
  icFg: string
}

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
  task: Task
}

export interface Dashboard {
  kpis: { label: string; value: number; note: string; fg: string; icon: string }[]
  attention: AttentionRow[]
  reasons: Record<
    AttentionKind,
    { reason: string; icon: string; bg: string; fg: string; bar: string }
  >
  myTasks: Task[]
  projects: Project[]
  sprint: (Sprint & { daysLeft: number }) | null
  activity: ActivityItem[]
  mentions: Notification[]
}

export interface Workflow {
  id: string
  name: string
  queues: number
  statuses: {
    id: string
    name: StatusName
    category: StatusCategory
    order: number
    color: string
  }[]
  transitions: {
    id: string
    from: StatusName
    to: StatusName
    fromId: string
    toId: string
    cond: string
    role: string
    roleKey: string
  }[]
}

export interface TaskField {
  id: string
  key: string
  label: string
  type: string
  icon: string
  screen: string
  req: boolean
  card: boolean
  system: boolean
}

export interface PermissionMatrix {
  roles: { key: AccessRole; label: string }[]
  rows: { id: string; label: string; cells: boolean[] }[]
}

export interface AutomationRule {
  id: string
  name: string
  trigger: string
  triggerLabel: string
  cond: string
  action: string
  condition: Record<string, unknown>
  actions: Record<string, unknown>[]
  queue: string | null
  icon: string
  iconFg: string
  on: boolean
  runs: string
  runCount: number
  lastRun: string | null
}

export interface TaskTemplate {
  id: string
  name: string
  icon: string
  note: string
  body: string
  queue: string | null
  tags: string[]
}

export interface SavedFilter {
  id: string
  label: string
  query: string
  icon: string
  icf: string
  favorite: boolean
  shared: boolean
  mine: boolean
  owner: PersonId
  ownerName: string
  n: number
  error: string | null
}

export interface FilterLibrary {
  favorites: SavedFilter[]
  saved: SavedFilter[]
  team: SavedFilter[]
}

export interface FilterFieldCatalog {
  fields: { key: string; label: string; icon: string; values: string[] }[]
  people: { code: PersonId; name: string }[]
}

export interface Reports {
  kpis: { label: string; value: string; delta: string; fg: string; deltaFg: string }[]
  statusSplit: { label: string; n: number; c: string }[]
  throughput: { label: string; n: number; h: string }[]
  workload: (Person & {
    sp: number
    tasks: number
    doneW: string
    progW: string
    todoW: string
  })[]
  sprintMetrics: { label: string; plan: string; fact: string; pct: string; fg: string; state: string }[]
  overdue: { key: string; title: string; late: string; days: number }[]
}

export interface Burndown {
  sprint: string | null
  total: number
  remaining: number
  points: { label: string; remaining: number; ideal: number }[]
}

export interface Org {
  name: string
  unit: string
  mark: string
  version: string
  /** Регистрация закрыта: приглашения не работают, учётки заводит админ. */
  registrationClosed?: boolean
}

export interface SearchResult {
  tasks: Task[]
  projects: { id: string; name: string; abbr: string }[]
  queues: { id: string; key: string; name: string }[]
  people: { id: string; code: PersonId; name: string; initials: string; jobTitle: string }[]
}

export interface Invite {
  id: string
  email: string
  role: AccessRole
  token: string
  expiresAt: string
  createdBy?: string
  expired?: boolean
}

export interface ToastItem {
  id: number
  title: string
  text: string
  kind: ToastKind
}

export type ToastKind = 'ok' | 'info' | 'warn' | 'err'

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
