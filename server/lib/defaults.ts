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
  { name: 'Новая', category: 'todo' },
  { name: 'Открыта', category: 'todo' },
  { name: 'В работе', category: 'inprogress' },
  { name: 'На проверке', category: 'inprogress' },
  { name: 'Тестирование', category: 'inprogress' },
  { name: 'Готово', category: 'done' },
  { name: 'Заблокирована', category: 'blocked' },
] as const

/** Граф переходов: вперёд по потоку, назад на доработку и в блокировку. */
export const DEFAULT_TRANSITIONS: readonly [string, string, string, string][] = [
  ['Новая', 'Открыта', 'заполнены обязательные поля', 'member'],
  ['Новая', 'В работе', 'назначен исполнитель', 'member'],
  ['Открыта', 'В работе', 'назначен исполнитель', 'member'],
  ['Открыта', 'Новая', 'возврат в очередь', 'member'],
  ['В работе', 'На проверке', 'указана оценка, есть описание', 'member'],
  ['В работе', 'Открыта', 'работа приостановлена', 'member'],
  ['В работе', 'Готово', 'изменение не требует проверки', 'manager'],
  ['На проверке', 'Тестирование', 'проверка пройдена', 'member'],
  ['На проверке', 'В работе', 'есть замечания', 'member'],
  ['На проверке', 'Готово', 'проверка пройдена, тесты не нужны', 'manager'],
  ['Тестирование', 'Готово', 'регресс пройден, чек-лист закрыт', 'manager'],
  ['Тестирование', 'В работе', 'найдены дефекты', 'member'],
  ['Тестирование', 'На проверке', 'нужен повторный просмотр', 'member'],
  ['Готово', 'В работе', 'задача переоткрыта', 'manager'],
  ['Готово', 'Открыта', 'задача переоткрыта', 'manager'],
  ['В работе', 'Заблокирована', 'указана причина блокировки', 'member'],
  ['На проверке', 'Заблокирована', 'указана причина блокировки', 'member'],
  ['Тестирование', 'Заблокирована', 'указана причина блокировки', 'member'],
  ['Открыта', 'Заблокирована', 'указана причина блокировки', 'member'],
  ['Заблокирована', 'В работе', 'блокировка снята', 'member'],
  ['Заблокирована', 'Открыта', 'блокировка снята', 'member'],
]

/** Воркфлоу по умолчанию — с него начинается любая новая установка. */
export const DEFAULT_WORKFLOW = 'Разработка'

export const DEFAULT_FIELDS = [
  { key: 'title', label: 'Заголовок', type: 'string', icon: 'title', screen: 'Все', required: true, onCard: true, system: true },
  { key: 'description', label: 'Описание', type: 'text', icon: 'description', screen: 'Все', required: false, onCard: false, system: true },
  { key: 'assignee', label: 'Исполнитель', type: 'user', icon: 'person', screen: 'Все', required: false, onCard: true, system: true },
  { key: 'sprint', label: 'Спринт', type: 'sprint', icon: 'rotate_right', screen: 'Agile', required: false, onCard: true, system: true },
  { key: 'estimate', label: 'Оценка, баллы', type: 'number', icon: 'straighten', screen: 'Agile', required: false, onCard: true, system: true },
  { key: 'dueDate', label: 'Срок', type: 'date', icon: 'calendar_today', screen: 'Все', required: false, onCard: true, system: true },
] as const

export const DEFAULT_BOARD_COLUMNS = [
  { name: 'Новые', statuses: ['Новая'], wipLimit: 0, order: 0 },
  { name: 'К работе', statuses: ['Открыта'], wipLimit: 0, order: 1 },
  { name: 'В работе', statuses: ['В работе', 'Заблокирована'], wipLimit: 6, order: 2 },
  { name: 'Проверка', statuses: ['На проверке', 'Тестирование'], wipLimit: 4, order: 3 },
  { name: 'Готово', statuses: ['Готово'], wipLimit: 0, order: 4 },
] as const

/** Шаблоны задач: полезны сразу, но при желании удаляются в настройках. */
export const DEFAULT_TEMPLATES = [
  {
    name: 'Ошибка',
    icon: 'bug_report',
    tags: ['ошибка', 'проверка'],
    note: 'Шаги воспроизведения, ожидаемое и фактическое поведение, окружение.',
    body: 'Шаги воспроизведения:\n1.\n2.\n\nОжидаемое поведение:\n\nФактическое поведение:\n\nОкружение:',
  },
  {
    name: 'Дизайн-задача',
    icon: 'design_services',
    tags: ['интерфейс', 'дизайн'],
    note: 'Контекст, ограничения, состояния макета и критерии приёмки.',
    body: 'Контекст:\n\nОграничения:\n\nСостояния:\n\nКритерии приёмки:',
  },
  {
    name: 'Интеграция',
    icon: 'sync_alt',
    tags: ['интеграция', 'обмен'],
    note: 'Описание обмена, соответствие полей, обработка ошибок и ограничения.',
    body: 'Описание обмена:\n\nСоответствие полей:\n\nОбработка ошибок:\n\nОграничения:',
  },
  {
    name: 'Чек-лист выпуска',
    icon: 'checklist',
    tags: ['выпуск', 'проверка'],
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
  { name: 'Ошибка', icon: 'bug_report', color: 'var(--dang)', epic: false, system: true },
  { name: 'Улучшение', icon: 'trending_up', color: 'var(--ok)', epic: false, system: true },
  { name: 'Эпик', icon: 'bolt', color: 'var(--vio)', epic: true, system: true },
]

/**
 * Резолюции — причина закрытия задачи. Без них «Done» не отличает
 * решённую задачу от отменённой, и отчёты приписывают команде чужую заслугу.
 */
export const DEFAULT_RESOLUTIONS = [
  { name: 'Решена', kind: 'success', system: true },
  { name: 'Выполнено частично', kind: 'success', system: true },
  { name: 'Дубликат', kind: 'neutral', system: true },
  { name: 'Не воспроизводится', kind: 'neutral', system: true },
  { name: 'Не актуально', kind: 'rejected', system: true },
  { name: 'Отклонена', kind: 'rejected', system: true },
]
