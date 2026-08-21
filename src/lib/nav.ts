export interface NavItem {
  to: string
  label: string
  icon: string
  count?: number
  /** Additional path prefixes that should keep this item highlighted. */
  also?: string[]
}

export const NAV_MAIN: NavItem[] = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/tasks', label: 'Задачи', icon: 'checklist', count: 128 },
  { to: '/queues', label: 'Очереди', icon: 'layers', count: 6 },
  { to: '/projects', label: 'Проекты', icon: 'folder_open', count: 6 },
  { to: '/board', label: 'Доски', icon: 'view_kanban' },
  { to: '/backlog', label: 'Спринты', icon: 'rotate_right' },
]

export const NAV_ADMIN: NavItem[] = [
  { to: '/filters', label: 'Фильтры', icon: 'filter_alt' },
  { to: '/reports', label: 'Отчёты', icon: 'monitoring' },
  { to: '/teams', label: 'Команды', icon: 'groups' },
  { to: '/workflow', label: 'Настройки', icon: 'settings' },
]

/** Breadcrumb trail per route, rendered after the workspace name. */
export const CRUMBS: Record<string, string> = {
  '/': 'Главная',
  '/tasks': 'Задачи',
  '/queues': 'Очереди',
  '/projects': 'Проекты',
  '/board': 'Доска',
  '/backlog': 'Планирование спринта',
  '/filters': 'Расширенный поиск',
  '/reports': 'Отчёты',
  '/teams': 'Команды',
  '/workflow': 'Настройки очереди',
}

export const CREATE_ITEMS = [
  { label: 'Задача', icon: 'add_task', kb: 'C' },
  { label: 'Проект', icon: 'folder_open', kb: 'P' },
  { label: 'Очередь', icon: 'layers', kb: 'Q' },
  { label: 'Правило автоматизации', icon: 'bolt', kb: 'A' },
]

export const SEARCH_NAV = [
  { label: 'Открыть доску команды', icon: 'view_kanban', kb: 'B', to: '/board' },
  { label: 'Планирование спринта', icon: 'rotate_right', kb: 'S', to: '/backlog' },
  { label: 'Настройки воркфлоу', icon: 'account_tree', kb: 'W', to: '/workflow' },
]
