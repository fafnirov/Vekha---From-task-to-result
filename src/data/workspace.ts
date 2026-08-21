import type {
  AutomationRule,
  Permission,
  Queue,
  SavedFilter,
  TaskField,
  TaskTemplate,
  Team,
  Transition,
} from './types'

/* Queues ------------------------------------------------------------ */

export const QUEUES: Queue[] = [
  {
    key: 'VEKHA',
    name: 'Платформа',
    owner: 'AK',
    n: 128,
    wf: 'Разработка',
    access: 'команда',
    accBg: 'var(--ac-soft)',
    accFg: 'var(--ac-tx)',
  },
  {
    key: 'MOB',
    name: 'Мобильное приложение',
    owner: 'IV',
    n: 41,
    wf: 'Разработка',
    access: 'команда',
    accBg: 'var(--ac-soft)',
    accFg: 'var(--ac-tx)',
  },
  {
    key: 'LMS',
    name: 'Интеграция с LMS',
    owner: 'PG',
    n: 28,
    wf: 'Интеграции',
    access: 'ограничен',
    accBg: 'var(--warn-bg)',
    accFg: 'var(--warn)',
  },
  {
    key: 'SEC',
    name: 'Безопасность',
    owner: 'EL',
    n: 19,
    wf: 'Аудит',
    access: 'закрытый',
    accBg: 'var(--dang-bg)',
    accFg: 'var(--dang)',
  },
  {
    key: 'INT',
    name: 'Внутренние инструменты',
    owner: 'DS',
    n: 30,
    wf: 'Разработка',
    access: 'вся компания',
    accBg: 'var(--ok-bg)',
    accFg: 'var(--ok)',
  },
  {
    key: 'REL',
    name: 'Релизы',
    owner: 'MN',
    n: 17,
    wf: 'Релизный',
    access: 'команда',
    accBg: 'var(--ac-soft)',
    accFg: 'var(--ac-tx)',
  },
]

/* Teams -------------------------------------------------------------- */

export const TEAMS: Team[] = [
  {
    abbr: 'ПК',
    name: 'Продуктовая команда',
    note: 'Платформа и веб-клиент',
    load: '86%',
    bg: 'var(--ac-soft2)',
    fg: 'var(--ac-tx)',
    members: [
      { id: 'AK', tasks: 13 },
      { id: 'DS', tasks: 18 },
      { id: 'MN', tasks: 8 },
    ],
  },
  {
    abbr: 'МБ',
    name: 'Мобильная команда',
    note: 'iOS и Android',
    load: '64%',
    bg: 'var(--info-bg)',
    fg: 'var(--info)',
    members: [
      { id: 'IV', tasks: 11 },
      { id: 'DS', tasks: 4 },
    ],
  },
  {
    abbr: 'ИН',
    name: 'Интеграции',
    note: 'Партнёрские системы и LMS',
    load: '72%',
    bg: 'var(--vio-bg)',
    fg: 'var(--vio)',
    members: [
      { id: 'PG', tasks: 9 },
      { id: 'DS', tasks: 3 },
    ],
  },
  {
    abbr: 'КБ',
    name: 'Качество и безопасность',
    note: 'QA, регресс, аудит доступа',
    load: '58%',
    bg: 'var(--warn-bg)',
    fg: 'var(--warn)',
    members: [
      { id: 'EL', tasks: 7 },
      { id: 'MN', tasks: 2 },
    ],
  },
]

/* Workflow ------------------------------------------------------------ */

export const TRANSITIONS: Transition[] = [
  {
    from: 'New',
    to: 'Open',
    cond: 'заполнены обязательные поля',
    role: 'Все участники',
  },
  {
    from: 'Open',
    to: 'In Progress',
    cond: 'назначен исполнитель',
    role: 'Исполнитель, лид',
  },
  {
    from: 'In Progress',
    to: 'Review',
    cond: 'указана оценка, есть описание',
    role: 'Исполнитель',
  },
  { from: 'Review', to: 'Testing', cond: 'ревью одобрено', role: 'Ревьюер, лид' },
  {
    from: 'Testing',
    to: 'Done',
    cond: 'регресс пройден, чек-лист закрыт',
    role: 'QA, лид',
  },
  {
    from: 'In Progress',
    to: 'Blocked',
    cond: 'указана причина блокировки',
    role: 'Все участники',
  },
]

/** Node positions for the workflow schema canvas, in px. */
export const WF_NODES = [
  { id: 'New', label: 'New', left: 24, top: 26 },
  { id: 'Open', label: 'Open', left: 168, top: 26 },
  { id: 'In Progress', label: 'In Progress', left: 316, top: 96 },
  { id: 'Review', label: 'Review', left: 316, top: 190 },
  { id: 'Testing', label: 'Testing', left: 486, top: 190 },
  { id: 'Done', label: 'Done', left: 486, top: 96 },
] as const

export const WF_EDGES = [
  { left: 96, top: 42, w: 72, h: 1 },
  { left: 240, top: 42, w: 1, h: 70 },
  { left: 240, top: 112, w: 76, h: 1 },
  { left: 366, top: 128, w: 1, h: 62 },
  { left: 420, top: 206, w: 66, h: 1 },
  { left: 552, top: 128, w: 1, h: 62 },
]

export const TASK_FIELDS: TaskField[] = [
  {
    id: 'f1',
    label: 'Заголовок',
    type: 'string',
    icon: 'title',
    screen: 'Все',
    req: true,
    card: true,
  },
  {
    id: 'f2',
    label: 'Описание',
    type: 'text',
    icon: 'description',
    screen: 'Все',
    req: false,
    card: false,
  },
  {
    id: 'f3',
    label: 'Исполнитель',
    type: 'user',
    icon: 'person',
    screen: 'Все',
    req: true,
    card: true,
  },
  {
    id: 'f4',
    label: 'Спринт',
    type: 'sprint',
    icon: 'rotate_right',
    screen: 'Agile',
    req: false,
    card: true,
  },
  {
    id: 'f5',
    label: 'Оценка (SP)',
    type: 'number',
    icon: 'straighten',
    screen: 'Agile',
    req: false,
    card: true,
  },
  {
    id: 'f6',
    label: 'Компонент',
    type: 'enum',
    icon: 'category',
    screen: 'Все',
    req: false,
    card: false,
  },
  {
    id: 'f7',
    label: 'Дедлайн',
    type: 'date',
    icon: 'calendar_today',
    screen: 'Все',
    req: false,
    card: true,
  },
  {
    id: 'f8',
    label: 'Регресс проверен',
    type: 'boolean',
    icon: 'check_box',
    screen: 'QA',
    req: false,
    card: false,
  },
]

export const ROLE_COLS = ['Админ', 'Лид', 'Участник', 'Гость', 'Заказчик']

export const PERMISSIONS: Permission[] = [
  { id: 'p1', label: 'Просмотр задач', cells: [true, true, true, true, true] },
  { id: 'p2', label: 'Создание задач', cells: [true, true, true, true, false] },
  { id: 'p3', label: 'Изменение статуса', cells: [true, true, true, false, false] },
  {
    id: 'p4',
    label: 'Редактирование чужих задач',
    cells: [true, true, false, false, false],
  },
  {
    id: 'p5',
    label: 'Управление спринтами',
    cells: [true, true, false, false, false],
  },
  {
    id: 'p6',
    label: 'Настройка воркфлоу',
    cells: [true, false, false, false, false],
  },
  { id: 'p7', label: 'Удаление задач', cells: [true, false, false, false, false] },
]

export const RULES: AutomationRule[] = [
  {
    id: 'r1',
    name: 'Перевод в Review уведомляет ревьюера',
    trigger: 'Смена статуса',
    cond: 'status = Review',
    action: 'Уведомить + назначить ревьюера',
    runs: '214 запусков',
    icon: 'rate_review',
    iconFg: 'var(--warn)',
    on: true,
  },
  {
    id: 'r2',
    name: 'Просроченные задачи поднимают приоритет',
    trigger: 'Ежедневно 09:00',
    cond: 'deadline < now()',
    action: 'priority → High, комментарий',
    runs: '86 запусков',
    icon: 'schedule',
    iconFg: 'var(--dang)',
    on: true,
  },
  {
    id: 'r3',
    name: 'Закрытие подзадач закрывает родителя',
    trigger: 'Задача закрыта',
    cond: 'все подзадачи Done',
    action: 'Родитель → Done',
    runs: '47 запусков',
    icon: 'account_tree',
    iconFg: 'var(--ok)',
    on: true,
  },
  {
    id: 'r4',
    name: 'Автоназначение по компоненту',
    trigger: 'Создание задачи',
    cond: 'component = Навигация',
    action: 'assignee → Анна Ковалёва',
    runs: '132 запуска',
    icon: 'person_add',
    iconFg: 'var(--ac)',
    on: false,
  },
]

export const TEMPLATES: TaskTemplate[] = [
  {
    name: 'Баг',
    icon: 'bug_report',
    note: 'Шаги воспроизведения, ожидаемое и фактическое поведение, окружение.',
    tags: ['bug', 'qa'],
  },
  {
    name: 'Дизайн-задача',
    icon: 'design_services',
    note: 'Контекст, ограничения, состояния макета и критерии приёмки.',
    tags: ['ui', 'design'],
  },
  {
    name: 'Интеграция',
    icon: 'sync_alt',
    note: 'Контракт API, маппинг полей, обработка ошибок и лимиты.',
    tags: ['api', 'integration'],
  },
  {
    name: 'Релизный чек-лист',
    icon: 'checklist',
    note: 'Регресс, миграции, откат, оповещение поддержки и заказчика.',
    tags: ['release', 'qa'],
  },
]

/* Filters ------------------------------------------------------------- */

export const FAV_FILTERS: SavedFilter[] = [
  { label: 'Мои открытые', n: 6, icon: 'push_pin', icf: 'var(--ac)' },
  { label: 'Ждут моего ревью', n: 3, icon: 'push_pin', icf: 'var(--ac)' },
]

export const SAVED_FILTERS: SavedFilter[] = [
  { label: 'Просроченные', n: 4, icon: 'schedule', icf: 'var(--dang)' },
  { label: 'Критичные в спринте', n: 2, icon: 'priority_high', icf: 'var(--dang)' },
  { label: 'Без исполнителя', n: 5, icon: 'person_off', icf: 'var(--tx3)' },
  { label: 'Незаоценённые', n: 2, icon: 'straighten', icf: 'var(--warn)' },
  { label: 'Закрыто за неделю', n: 12, icon: 'task_alt', icf: 'var(--ok)' },
  { label: 'Блокирующие релиз', n: 1, icon: 'block', icf: 'var(--dang)' },
]

export const TEAM_FILTERS = [
  { label: 'Регресс Release 2.4', who: 'DS' as const },
  { label: 'Интеграции: ждут партнёра', who: 'PG' as const },
  { label: 'Дизайн на ревью', who: 'MN' as const },
]

export const RECENT_FILTERS = [
  { label: 'queue = VEKHA AND status = Review' },
  { label: 'assignee = currentUser() AND deadline <= endOfWeek()' },
]

/* Reports -------------------------------------------------------------- */

export const REPORT_KPIS = [
  {
    label: 'Закрыто задач',
    value: '34',
    delta: '+21%',
    fg: 'var(--tx)',
    deltaFg: 'var(--ok)',
  },
  {
    label: 'Среднее время цикла',
    value: '3.4д',
    delta: '−0.6д',
    fg: 'var(--tx)',
    deltaFg: 'var(--ok)',
  },
  {
    label: 'Соблюдение сроков',
    value: '87%',
    delta: 'цель 90%',
    fg: 'var(--tx)',
    deltaFg: 'var(--tx3)',
  },
  {
    label: 'Просрочено',
    value: '4',
    delta: '+1',
    fg: 'var(--dang)',
    deltaFg: 'var(--dang)',
  },
]

export const STATUS_SPLIT = [
  { label: 'Done', n: 79, c: 'var(--ok)' },
  { label: 'In Progress', n: 22, c: 'var(--ac)' },
  { label: 'Review / Testing', n: 13, c: 'var(--warn)' },
  { label: 'Open / New', n: 9, c: 'var(--info)' },
  { label: 'Blocked', n: 5, c: 'var(--dang)' },
]

export const THROUGHPUT = [
  { label: 'н28', n: 9, h: '46%' },
  { label: 'н29', n: 12, h: '61%' },
  { label: 'н30', n: 7, h: '36%' },
  { label: 'н31', n: 14, h: '72%' },
  { label: 'н32', n: 11, h: '56%' },
  { label: 'н33', n: 17, h: '87%' },
  { label: 'н34', n: 19, h: '97%' },
  { label: 'н35', n: 13, h: '66%' },
]

export const BURNDOWN_DAYS = ['12', '14', '16', '18', '20', '21', '23', '25']

export const SPRINT_METRICS = [
  { label: 'Sprint 21', plan: '48', fact: '41', pct: '85%', fg: 'var(--warn)' },
  { label: 'Sprint 22', plan: '46', fact: '46', pct: '100%', fg: 'var(--ok)' },
  { label: 'Sprint 23', plan: '50', fact: '44', pct: '88%', fg: 'var(--warn)' },
  { label: 'Sprint 24', plan: '52', fact: '34', pct: '65%', fg: 'var(--ac)' },
]

export const REPORT_WORKLOAD = [
  { id: 'AK' as const, sp: 13, doneW: '46%', progW: '31%', todoW: '23%' },
  { id: 'DS' as const, sp: 18, doneW: '33%', progW: '45%', todoW: '22%' },
  { id: 'MN' as const, sp: 8, doneW: '62%', progW: '25%', todoW: '13%' },
  { id: 'IV' as const, sp: 11, doneW: '27%', progW: '36%', todoW: '37%' },
  { id: 'EL' as const, sp: 7, doneW: '57%', progW: '14%', todoW: '29%' },
  { id: 'PG' as const, sp: 9, doneW: '22%', progW: '33%', todoW: '45%' },
]

export const OVERDUE = [
  { key: 'LMS-23', late: '2 дня' },
  { key: 'VEKHA-141', late: 'сегодня' },
  { key: 'SEC-12', late: '1 день' },
  { key: 'REL-22', late: '3 дня' },
]

export const WIDGET_LIBRARY = [
  { label: 'Burndown', icon: 'trending_down' },
  { label: 'Velocity', icon: 'speed' },
  { label: 'Cumulative flow', icon: 'stacked_line_chart' },
  { label: 'Время цикла', icon: 'timelapse' },
  { label: 'Нагрузка команды', icon: 'groups' },
  { label: 'Просрочки', icon: 'schedule' },
  { label: 'Распределение по статусам', icon: 'donut_small' },
  { label: 'Закрытые по неделям', icon: 'bar_chart' },
]
