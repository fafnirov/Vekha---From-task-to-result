/**
 * Каркас рабочего пространства: статусы, переходы, поля, колонки доски.
 *
 * Это не демонстрационные данные, а минимум, без которого приложение
 * не работает: без прав администратор не может ничего, без воркфлоу
 * нельзя завести очередь, без колонок доска пуста навсегда.
 * Один источник и для наполнения базы, и для самовосстановления
 * при старте сервера — иначе они разъедутся.
 */

export const DEFAULT_STATUSES = [
  { name: 'New', category: 'todo' },
  { name: 'Open', category: 'todo' },
  { name: 'In Progress', category: 'inprogress' },
  { name: 'Review', category: 'inprogress' },
  { name: 'Testing', category: 'inprogress' },
  { name: 'Done', category: 'done' },
  { name: 'Blocked', category: 'blocked' },
] as const

/** Граф переходов: вперёд по потоку, назад на доработку и в блокировку. */
export const DEFAULT_TRANSITIONS: readonly [string, string, string, string][] = [
  ['New', 'Open', 'заполнены обязательные поля', 'member'],
  ['New', 'In Progress', 'назначен исполнитель', 'member'],
  ['Open', 'In Progress', 'назначен исполнитель', 'member'],
  ['Open', 'New', 'возврат в очередь', 'member'],
  ['In Progress', 'Review', 'указана оценка, есть описание', 'member'],
  ['In Progress', 'Open', 'работа приостановлена', 'member'],
  ['In Progress', 'Done', 'изменение не требует ревью', 'manager'],
  ['Review', 'Testing', 'ревью одобрено', 'member'],
  ['Review', 'In Progress', 'есть замечания', 'member'],
  ['Review', 'Done', 'ревью одобрено, тесты не нужны', 'manager'],
  ['Testing', 'Done', 'регресс пройден, чек-лист закрыт', 'manager'],
  ['Testing', 'In Progress', 'найдены дефекты', 'member'],
  ['Testing', 'Review', 'нужен повторный просмотр', 'member'],
  ['Done', 'In Progress', 'задача переоткрыта', 'manager'],
  ['Done', 'Open', 'задача переоткрыта', 'manager'],
  ['In Progress', 'Blocked', 'указана причина блокировки', 'member'],
  ['Review', 'Blocked', 'указана причина блокировки', 'member'],
  ['Testing', 'Blocked', 'указана причина блокировки', 'member'],
  ['Open', 'Blocked', 'указана причина блокировки', 'member'],
  ['Blocked', 'In Progress', 'блокировка снята', 'member'],
  ['Blocked', 'Open', 'блокировка снята', 'member'],
]

/** Воркфлоу по умолчанию — с него начинается любая новая установка. */
export const DEFAULT_WORKFLOW = 'Разработка'

export const DEFAULT_FIELDS = [
  { key: 'title', label: 'Заголовок', type: 'string', icon: 'title', screen: 'Все', required: true, onCard: true, system: true },
  { key: 'description', label: 'Описание', type: 'text', icon: 'description', screen: 'Все', required: false, onCard: false, system: true },
  { key: 'assignee', label: 'Исполнитель', type: 'user', icon: 'person', screen: 'Все', required: true, onCard: true, system: true },
  { key: 'sprint', label: 'Спринт', type: 'sprint', icon: 'rotate_right', screen: 'Agile', required: false, onCard: true, system: true },
  { key: 'estimate', label: 'Оценка (SP)', type: 'number', icon: 'straighten', screen: 'Agile', required: false, onCard: true, system: true },
  { key: 'component', label: 'Компонент', type: 'enum', icon: 'category', screen: 'Все', required: false, onCard: false, system: false },
  { key: 'dueDate', label: 'Дедлайн', type: 'date', icon: 'calendar_today', screen: 'Все', required: false, onCard: true, system: true },
  { key: 'regression', label: 'Регресс проверен', type: 'boolean', icon: 'check_box', screen: 'QA', required: false, onCard: false, system: false },
] as const

export const DEFAULT_BOARD_COLUMNS = [
  { name: 'Backlog', statuses: ['New'], wipLimit: 0, order: 0 },
  { name: 'To Do', statuses: ['Open'], wipLimit: 0, order: 1 },
  { name: 'In Progress', statuses: ['In Progress', 'Blocked'], wipLimit: 6, order: 2 },
  { name: 'Review', statuses: ['Review', 'Testing'], wipLimit: 4, order: 3 },
  { name: 'Done', statuses: ['Done'], wipLimit: 0, order: 4 },
] as const

/** Шаблоны задач: полезны сразу, но при желании удаляются в настройках. */
export const DEFAULT_TEMPLATES = [
  {
    name: 'Баг',
    icon: 'bug_report',
    tags: ['bug', 'qa'],
    note: 'Шаги воспроизведения, ожидаемое и фактическое поведение, окружение.',
    body: 'Шаги воспроизведения:\n1.\n2.\n\nОжидаемое поведение:\n\nФактическое поведение:\n\nОкружение:',
  },
  {
    name: 'Дизайн-задача',
    icon: 'design_services',
    tags: ['ui', 'design'],
    note: 'Контекст, ограничения, состояния макета и критерии приёмки.',
    body: 'Контекст:\n\nОграничения:\n\nСостояния:\n\nКритерии приёмки:',
  },
  {
    name: 'Интеграция',
    icon: 'sync_alt',
    tags: ['api', 'integration'],
    note: 'Контракт API, маппинг полей, обработка ошибок и лимиты.',
    body: 'Контракт API:\n\nМаппинг полей:\n\nОбработка ошибок:\n\nЛимиты:',
  },
  {
    name: 'Релизный чек-лист',
    icon: 'checklist',
    tags: ['release', 'qa'],
    note: 'Регресс, миграции, откат, оповещение поддержки и заказчика.',
    body: 'Регресс:\n\nМиграции:\n\nПлан отката:\n\nОповещения:',
  },
] as const

/**
 * Типы задач. В Яндекс Трекере тип определяет, как задача выглядит и
 * какие резолюции ей доступны; здесь он задаёт иконку, цвет и признак эпика.
 */
export const DEFAULT_TASK_TYPES = [
  { name: 'Задача', icon: 'task_alt', color: 'var(--info)', epic: false, system: true },
  { name: 'Баг', icon: 'bug_report', color: 'var(--dang)', epic: false, system: true },
  { name: 'Улучшение', icon: 'trending_up', color: 'var(--ok)', epic: false, system: true },
  { name: 'Эпик', icon: 'bolt', color: 'var(--vio)', epic: true, system: true },
]

/**
 * Резолюции — причина закрытия задачи. Без них «Done» не отличает
 * решённую задачу от отменённой, и отчёты приписывают команде чужую заслугу.
 */
export const DEFAULT_RESOLUTIONS = [
  { name: 'Решён', kind: 'success', system: true },
  { name: 'Выполнено частично', kind: 'success', system: true },
  { name: 'Дубликат', kind: 'neutral', system: true },
  { name: 'Не воспроизводится', kind: 'neutral', system: true },
  { name: 'Не актуально', kind: 'rejected', system: true },
  { name: 'Отклонён', kind: 'rejected', system: true },
]
