export interface NavItem {
  to: string
  label: string
  icon: string
  /** Ключ счётчика: подставляется из живых данных в Sidebar. */
  count?: 'tasks' | 'queues' | 'projects'
  /** Дополнительные префиксы пути, при которых пункт остаётся активным. */
  also?: string[]
}

export const NAV_MAIN: NavItem[] = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/tasks', label: 'Задачи', icon: 'checklist', count: 'tasks' },
  { to: '/queues', label: 'Очереди', icon: 'layers', count: 'queues' },
  { to: '/projects', label: 'Проекты', icon: 'folder_open', count: 'projects' },
  { to: '/board', label: 'Доски', icon: 'view_kanban' },
  { to: '/backlog', label: 'Спринты', icon: 'rotate_right' },
]

export const NAV_ADMIN: NavItem[] = [
  { to: '/filters', label: 'Фильтры', icon: 'filter_alt' },
  { to: '/reports', label: 'Отчёты', icon: 'monitoring' },
  { to: '/teams', label: 'Команды', icon: 'groups' },
  { to: '/workflow', label: 'Настройки', icon: 'settings' },
]

/** Хлебные крошки по маршруту, показываются после названия организации. */
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
  '/workflow': 'Настройки',
}

export const SEARCH_NAV = [
  { label: 'Открыть доску команды', icon: 'view_kanban', kb: 'B', to: '/board' },
  { label: 'Планирование спринта', icon: 'rotate_right', kb: 'S', to: '/backlog' },
  { label: 'Настройки воркфлоу', icon: 'account_tree', kb: 'W', to: '/workflow' },
  { label: 'Отчёты и метрики', icon: 'monitoring', kb: 'R', to: '/reports' },
]
