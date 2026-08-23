/**
 * Наполнение базы демонстрационным пространством «Норд Софт».
 *
 * Данные повторяют то, под что рисовался интерфейс, но живут в базе как
 * обычные записи: их можно править, удалять и дополнять. Даты задаются
 * смещением от сегодняшнего дня, поэтому дедлайны, спринт и отчёты
 * выглядят актуальными в любой день запуска.
 *
 *   npm run seed          — наполнить пустую базу
 *   npm run seed -- --force — очистить и наполнить заново
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  AVATAR_PALETTE,
  DEFAULT_PERMISSIONS,
  PERMISSION_KEYS,
  ROLES,
} from '../server/lib/constants.js'
import { codeFrom, initialsFrom, startOfDay } from '../server/lib/format.js'

const prisma = new PrismaClient()

const FORCE = process.argv.includes('--force')
const PASSWORD = process.env.SEED_PASSWORD ?? 'vekha2026'

/** Детерминированный генератор: одинаковый seed — одинаковая база. */
function rng(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}
const rand = rng(20_260_823)
const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)]

const TODAY = startOfDay(new Date())
/** Дата, сдвинутая от сегодняшнего дня; часы задаются для правдоподобной ленты. */
function day(offset: number, hour = 10, minute = 0): Date {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d
}

/* ── Справочники ──────────────────────────────────────────────────────── */

const PEOPLE = [
  { name: 'Анна Ковалёва', email: 'anna@nordsoft.ru', jobTitle: 'Product Lead', role: 'admin' },
  { name: 'Дмитрий Соколов', email: 'dmitry@nordsoft.ru', jobTitle: 'Backend', role: 'manager' },
  { name: 'Марина Нестерова', email: 'marina@nordsoft.ru', jobTitle: 'Design', role: 'member' },
  { name: 'Игорь Волков', email: 'igor@nordsoft.ru', jobTitle: 'Mobile', role: 'member' },
  { name: 'Елена Лапина', email: 'elena@nordsoft.ru', jobTitle: 'QA / Security', role: 'manager' },
  { name: 'Павел Гущин', email: 'pavel@nordsoft.ru', jobTitle: 'Integrations', role: 'member' },
]

const STATUSES = [
  { name: 'New', category: 'todo' },
  { name: 'Open', category: 'todo' },
  { name: 'In Progress', category: 'inprogress' },
  { name: 'Review', category: 'inprogress' },
  { name: 'Testing', category: 'inprogress' },
  { name: 'Done', category: 'done' },
  { name: 'Blocked', category: 'blocked' },
]

/** Граф переходов: вперёд по потоку, назад на доработку и в блокировку. */
const TRANSITIONS: [string, string, string, string][] = [
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

const WORKFLOWS = ['Разработка', 'Интеграции', 'Аудит', 'Релизный']

const QUEUES = [
  { key: 'VEKHA', name: 'Платформа', owner: 'AK', wf: 'Разработка', access: 'team' },
  { key: 'MOB', name: 'Мобильное приложение', owner: 'IV', wf: 'Разработка', access: 'team' },
  { key: 'LMS', name: 'Интеграция с LMS', owner: 'PG', wf: 'Интеграции', access: 'restricted' },
  { key: 'SEC', name: 'Безопасность', owner: 'EL', wf: 'Аудит', access: 'private' },
  { key: 'INT', name: 'Внутренние инструменты', owner: 'DS', wf: 'Разработка', access: 'company' },
  { key: 'REL', name: 'Релизы', owner: 'MN', wf: 'Релизный', access: 'team' },
]

const PROJECTS = [
  {
    name: 'Platform Redesign',
    abbr: 'PR',
    queue: 'VEKHA',
    lead: 'AK',
    state: 'active',
    start: -103,
    due: 20,
    description: 'Переработка навигации, списка задач и страницы задачи.',
  },
  {
    name: 'Mobile App 2.0',
    abbr: 'MA',
    queue: 'MOB',
    lead: 'IV',
    state: 'active',
    start: -75,
    due: 38,
    description: 'Вторая версия мобильного клиента: офлайн и уведомления.',
  },
  {
    name: 'College LMS Integration',
    abbr: 'CL',
    queue: 'LMS',
    lead: 'PG',
    state: 'risk',
    start: -60,
    due: 53,
    description: 'Синхронизация групп, ролей и расписания с внешней LMS.',
  },
  {
    name: 'Security Audit',
    abbr: 'SA',
    queue: 'SEC',
    lead: 'EL',
    state: 'active',
    start: -48,
    due: 13,
    description: 'Аудит прав доступа, хранения вложений и журналов.',
  },
  {
    name: 'Internal Tools',
    abbr: 'IT',
    queue: 'INT',
    lead: 'DS',
    state: 'active',
    start: -90,
    due: 28,
    description: 'Внутренние отчёты, экспорт и служебные автоматизации.',
  },
  {
    name: 'Release 2.4',
    abbr: 'R4',
    queue: 'REL',
    lead: 'MN',
    state: 'release',
    start: -30,
    due: 4,
    description: 'Подготовка, регресс и приёмка релиза 2.4.',
  },
]

const MILESTONES: Record<string, { title: string; note: string; at: number; state: string }[]> = {
  'Platform Redesign': [
    { title: 'Исследование завершено', note: 'Аудит навигации, 12 интервью, карта проблем', at: -78, state: 'done' },
    { title: 'Дизайн-концепция утверждена', note: 'Навигация, список задач, страница задачи', at: -25, state: 'done' },
    { title: 'Разработка ядра интерфейса', note: '8 задач в работе, 3 на ревью', at: 6, state: 'active' },
    { title: 'Приёмка и аудит доступа', note: 'Регресс, аудит прав, подготовка релиза', at: 20, state: 'planned' },
  ],
  'Mobile App 2.0': [
    { title: 'Каркас приложения', note: 'Навигация и экраны списка', at: -40, state: 'done' },
    { title: 'Бета для внутренних команд', note: 'Офлайн-режим и push', at: 14, state: 'active' },
    { title: 'Публикация в сторах', note: 'Сборка, метаданные, раскатка', at: 38, state: 'planned' },
  ],
  'College LMS Integration': [
    { title: 'Контракт API согласован', note: 'Схемы обмена и лимиты', at: -35, state: 'done' },
    { title: 'Синхронизация групп с LMS', note: 'Ожидание данных партнёра', at: 9, state: 'active' },
    { title: 'Приёмочные испытания', note: 'Сверка данных за семестр', at: 53, state: 'planned' },
  ],
  'Security Audit': [
    { title: 'Инвентаризация доступов', note: 'Очереди, проекты, интеграции', at: -20, state: 'done' },
    { title: 'Отчёт по правам доступа', note: 'Замечания и план исправлений', at: 13, state: 'active' },
  ],
  'Internal Tools': [
    { title: 'Каталог отчётов', note: 'Согласован состав виджетов', at: -50, state: 'done' },
    { title: 'Экспорт отчётов в XLSX', note: 'Формат и планировщик выгрузок', at: 28, state: 'active' },
  ],
  'Release 2.4': [
    { title: 'Код заморожен', note: 'Только исправления дефектов', at: -6, state: 'done' },
    { title: 'Регресс и приёмка', note: 'Чек-лист из 42 пунктов', at: 4, state: 'active' },
  ],
}

const SPRINTS = [
  { name: 'Sprint 21', queue: 'VEKHA', start: -73, end: -60, state: 'closed', capacity: 48 },
  { name: 'Sprint 22', queue: 'VEKHA', start: -59, end: -46, state: 'closed', capacity: 46 },
  { name: 'Sprint 23', queue: 'VEKHA', start: -45, end: -32, state: 'closed', capacity: 50 },
  { name: 'Sprint 24', queue: 'VEKHA', start: -10, end: 11, state: 'active', capacity: 52,
    goal: 'Ядро нового интерфейса и массовые действия' },
]

interface SeedTask {
  key: string
  title: string
  status: string
  priority: string
  who: string | null
  project: string | null
  queue: string
  sprint: string | null
  due: number | null
  est: number | null
  tags: string[]
  created: number
  description?: string
}

const TASKS: SeedTask[] = [
  {
    key: 'VEKHA-142', title: 'Переработать структуру левой навигации',
    status: 'In Progress', priority: 'high', who: 'AK', project: 'Platform Redesign',
    queue: 'VEKHA', sprint: 'Sprint 24', due: 5, est: 5, tags: ['ui', 'frontend'], created: -11,
    description:
      'Текущая карта разделов содержит 14 пунктов, четыре из них ведут на один и тот же список задач.\n\n' +
      'Нужно сократить меню до восьми разделов, вынести администрирование вниз и проверить свёрнутое состояние на экранах 13 дюймов.\n\n' +
      'Критерии приёмки:\n' +
      '— не больше восьми основных разделов;\n' +
      '— свёрнутое меню читается без подписей;\n' +
      '— разделы без прав скрываются, а не блокируются.',
  },
  {
    key: 'VEKHA-141', title: 'Ошибка сортировки в списке задач при смене представления',
    status: 'In Progress', priority: 'critical', who: 'DS', project: 'Platform Redesign',
    queue: 'VEKHA', sprint: 'Sprint 24', due: 0, est: 3, tags: ['bug'], created: -6,
    description: 'Сортировка сбрасывается при переключении представления. Воспроизводится на списке из 50+ задач.',
  },
  {
    key: 'VEKHA-138', title: 'Массовые действия для выбранных задач',
    status: 'Review', priority: 'high', who: 'MN', project: 'Platform Redesign',
    queue: 'VEKHA', sprint: 'Sprint 24', due: -1, est: 8, tags: ['ui'], created: -18,
    description: 'Смена статуса, исполнителя и спринта для набора задач одним действием.',
  },
  {
    key: 'MOB-87', title: 'Офлайн-режим для списка задач',
    status: 'Open', priority: 'medium', who: 'IV', project: 'Mobile App 2.0',
    queue: 'MOB', sprint: 'Sprint 24', due: 10, est: 13, tags: ['mobile'], created: -14,
  },
  {
    key: 'MOB-84', title: 'Push-уведомления по упоминаниям',
    status: 'In Progress', priority: 'medium', who: 'IV', project: 'Mobile App 2.0',
    queue: 'MOB', sprint: 'Sprint 24', due: 6, est: 5, tags: ['mobile', 'api'], created: -20,
  },
  {
    key: 'LMS-23', title: 'Синхронизация групп с College LMS',
    status: 'Blocked', priority: 'critical', who: 'PG', project: 'College LMS Integration',
    queue: 'LMS', sprint: 'Sprint 24', due: -4, est: 8, tags: ['api', 'integration'], created: -26,
    description: 'Партнёр не отдаёт список групп по API. Ждём ответа команды интеграции.',
  },
  {
    key: 'LMS-21', title: 'Маппинг ролей преподавателей',
    status: 'Open', priority: 'high', who: 'PG', project: 'College LMS Integration',
    queue: 'LMS', sprint: null, due: 13, est: 5, tags: ['api'], created: -22,
  },
  {
    key: 'SEC-12', title: 'Аудит прав доступа к очередям',
    status: 'Testing', priority: 'high', who: 'EL', project: 'Security Audit',
    queue: 'SEC', sprint: 'Sprint 24', due: 2, est: 5, tags: ['security'], created: -16,
  },
  {
    key: 'SEC-9', title: 'Политика хранения вложений',
    status: 'New', priority: 'medium', who: null, project: 'Security Audit',
    queue: 'SEC', sprint: null, due: 16, est: 3, tags: ['security', 'docs'], created: -9,
  },
  {
    key: 'VEKHA-136', title: 'Конструктор фильтров: сохранённые представления',
    status: 'Done', priority: 'medium', who: 'AK', project: 'Platform Redesign',
    queue: 'VEKHA', sprint: 'Sprint 23', due: -8, est: 8, tags: ['ui'], created: -34,
  },
  {
    key: 'INT-45', title: 'Автоматизация: закрытие задач по релизу',
    status: 'Open', priority: 'low', who: 'DS', project: 'Internal Tools',
    queue: 'INT', sprint: null, due: 20, est: 3, tags: ['automation'], created: -12,
  },
  {
    key: 'INT-41', title: 'Экспорт отчётов в XLSX',
    status: 'Review', priority: 'medium', who: 'MN', project: 'Internal Tools',
    queue: 'INT', sprint: 'Sprint 24', due: 3, est: 5, tags: ['reports'], created: -19,
  },
  {
    key: 'REL-24', title: 'Чек-лист приёмки Release 2.4',
    status: 'In Progress', priority: 'high', who: 'AK', project: 'Release 2.4',
    queue: 'REL', sprint: 'Sprint 24', due: 4, est: 3, tags: ['release'], created: -8,
  },
  {
    key: 'REL-22', title: 'Регресс-тестирование доски',
    status: 'Testing', priority: 'medium', who: 'DS', project: 'Release 2.4',
    queue: 'REL', sprint: 'Sprint 24', due: -3, est: 8, tags: ['qa'], created: -15,
  },
  {
    key: 'VEKHA-131', title: 'Skeleton-состояния для тяжёлых таблиц',
    status: 'Done', priority: 'low', who: 'MN', project: 'Platform Redesign',
    queue: 'VEKHA', sprint: 'Sprint 23', due: -9, est: 2, tags: ['ui'], created: -37,
  },
  {
    key: 'VEKHA-129', title: 'Настройка воркфлоу очереди VEKHA',
    status: 'New', priority: 'medium', who: 'PG', project: 'Platform Redesign',
    queue: 'VEKHA', sprint: null, due: null, est: 5, tags: ['admin'], created: -5,
  },
]

/** Заголовки для исторических закрытых задач — чтобы отчёты были не пустыми. */
const HISTORY_TITLES = [
  'Починить перенос длинных заголовков',
  'Ускорить загрузку списка задач',
  'Добавить подсказки к горячим клавишам',
  'Обновить зависимости клиента',
  'Исправить фокус в модальном окне',
  'Поддержать вставку изображений в комментарии',
  'Разобрать замечания дизайн-ревью',
  'Покрыть фильтры тестами',
  'Согласовать формат экспорта',
  'Убрать дубли в ленте активности',
  'Настроить журналирование ошибок',
  'Перевести подписи на единый словарь',
  'Проверить контраст в тёмной теме',
  'Оптимизировать запрос к списку проектов',
  'Добавить пустое состояние для доски',
  'Исправить сортировку по дедлайну',
]

const TEAMS = [
  { name: 'Продуктовая команда', abbr: 'ПК', note: 'Платформа и веб-клиент', members: ['AK', 'DS', 'MN'] },
  { name: 'Мобильная команда', abbr: 'МБ', note: 'iOS и Android', members: ['IV', 'DS'] },
  { name: 'Интеграции', abbr: 'ИН', note: 'Партнёрские системы и LMS', members: ['PG', 'DS'] },
  { name: 'Качество и безопасность', abbr: 'КБ', note: 'QA, регресс, аудит доступа', members: ['EL', 'MN'] },
]

const FIELDS = [
  { key: 'title', label: 'Заголовок', type: 'string', icon: 'title', screen: 'Все', required: true, onCard: true, system: true },
  { key: 'description', label: 'Описание', type: 'text', icon: 'description', screen: 'Все', required: false, onCard: false, system: true },
  { key: 'assignee', label: 'Исполнитель', type: 'user', icon: 'person', screen: 'Все', required: true, onCard: true, system: true },
  { key: 'sprint', label: 'Спринт', type: 'sprint', icon: 'rotate_right', screen: 'Agile', required: false, onCard: true, system: true },
  { key: 'estimate', label: 'Оценка (SP)', type: 'number', icon: 'straighten', screen: 'Agile', required: false, onCard: true, system: true },
  { key: 'component', label: 'Компонент', type: 'enum', icon: 'category', screen: 'Все', required: false, onCard: false, system: false },
  { key: 'dueDate', label: 'Дедлайн', type: 'date', icon: 'calendar_today', screen: 'Все', required: false, onCard: true, system: true },
  { key: 'regression', label: 'Регресс проверен', type: 'boolean', icon: 'check_box', screen: 'QA', required: false, onCard: false, system: false },
]

const BOARD_COLUMNS = [
  { name: 'Backlog', statuses: ['New'], wipLimit: 0, order: 0 },
  { name: 'To Do', statuses: ['Open'], wipLimit: 0, order: 1 },
  { name: 'In Progress', statuses: ['In Progress', 'Blocked'], wipLimit: 6, order: 2 },
  { name: 'Review', statuses: ['Review', 'Testing'], wipLimit: 4, order: 3 },
  { name: 'Done', statuses: ['Done'], wipLimit: 0, order: 4 },
]

const RULES = [
  {
    name: 'Перевод в Review уведомляет ревьюера',
    trigger: 'status_changed',
    condition: { all: [{ field: 'status', op: 'eq', value: 'Review' }] },
    actions: [{ type: 'notify', role: 'manager', value: 'Задача ждёт вашего ревью' }],
    icon: 'rate_review', iconFg: 'var(--warn)', enabled: true, runs: 214,
  },
  {
    name: 'Просроченные задачи поднимают приоритет',
    trigger: 'schedule',
    condition: { all: [{ field: 'overdue', op: 'is', value: true }] },
    actions: [{ type: 'raise_priority', value: 'high' }],
    icon: 'schedule', iconFg: 'var(--dang)', enabled: true, runs: 86,
  },
  {
    name: 'Закрытие подзадач закрывает родителя',
    trigger: 'task_closed',
    condition: { all: [{ field: 'subtasksAllDone', op: 'is', value: true }] },
    actions: [{ type: 'notify', role: 'author', value: 'Все подзадачи закрыты' }],
    icon: 'account_tree', iconFg: 'var(--ok)', enabled: true, runs: 47,
  },
  {
    name: 'Блокировка зовёт владельца очереди',
    trigger: 'status_changed',
    condition: { all: [{ field: 'category', op: 'eq', value: 'blocked' }] },
    actions: [{ type: 'notify', role: 'manager', value: 'Задача заблокирована — нужен разбор' }],
    icon: 'block', iconFg: 'var(--dang)', enabled: true, runs: 19,
  },
  {
    name: 'Автоназначение задач по тегу security',
    trigger: 'task_created',
    condition: { all: [{ field: 'tags', op: 'contains', value: 'security' }] },
    actions: [{ type: 'set_assignee', value: 'EL' }],
    icon: 'person_add', iconFg: 'var(--ac)', enabled: false, runs: 132,
  },
]

const TEMPLATES = [
  {
    name: 'Баг', icon: 'bug_report', tags: ['bug', 'qa'],
    note: 'Шаги воспроизведения, ожидаемое и фактическое поведение, окружение.',
    body: 'Шаги воспроизведения:\n1.\n2.\n\nОжидаемое поведение:\n\nФактическое поведение:\n\nОкружение:',
  },
  {
    name: 'Дизайн-задача', icon: 'design_services', tags: ['ui', 'design'],
    note: 'Контекст, ограничения, состояния макета и критерии приёмки.',
    body: 'Контекст:\n\nОграничения:\n\nСостояния:\n\nКритерии приёмки:',
  },
  {
    name: 'Интеграция', icon: 'sync_alt', tags: ['api', 'integration'],
    note: 'Контракт API, маппинг полей, обработка ошибок и лимиты.',
    body: 'Контракт API:\n\nМаппинг полей:\n\nОбработка ошибок:\n\nЛимиты:',
  },
  {
    name: 'Релизный чек-лист', icon: 'checklist', tags: ['release', 'qa'],
    note: 'Регресс, миграции, откат, оповещение поддержки и заказчика.',
    body: 'Регресс:\n\nМиграции:\n\nПлан отката:\n\nОповещения:',
  },
]

const FILTERS = [
  { name: 'Мои открытые', query: 'assignee = currentUser() AND category != done', icon: 'push_pin', iconFg: 'var(--ac)', favorite: true, shared: false },
  { name: 'Ждут моего ревью', query: 'status = Review AND assignee = currentUser()', icon: 'push_pin', iconFg: 'var(--ac)', favorite: true, shared: false },
  { name: 'Просроченные', query: 'overdue = true', icon: 'schedule', iconFg: 'var(--dang)', favorite: false, shared: true },
  { name: 'Критичные в спринте', query: 'priority = Critical AND sprint = "Sprint 24"', icon: 'priority_high', iconFg: 'var(--dang)', favorite: false, shared: true },
  { name: 'Без исполнителя', query: 'assignee = empty() AND category != done', icon: 'person_off', iconFg: 'var(--tx3)', favorite: false, shared: true },
  { name: 'Незаоценённые', query: 'estimate = 0 AND category != done', icon: 'straighten', iconFg: 'var(--warn)', favorite: false, shared: false },
  { name: 'Блокирующие релиз', query: 'queue = REL AND category = blocked', icon: 'block', iconFg: 'var(--dang)', favorite: false, shared: true },
]

/* ── Очистка ──────────────────────────────────────────────────────────── */

async function wipe() {
  // Порядок важен: сначала таблицы со ссылками.
  await prisma.burndownPoint.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.activity.deleteMany()
  await prisma.worklog.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.watcher.deleteMany()
  await prisma.taskLink.deleteMany()
  await prisma.taskTag.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.task.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.project.deleteMany()
  await prisma.sprint.deleteMany()
  await prisma.automationRule.deleteMany()
  await prisma.taskTemplate.deleteMany()
  await prisma.savedFilter.deleteMany()
  await prisma.queue.deleteMany()
  await prisma.transition.deleteMany()
  await prisma.status.deleteMany()
  await prisma.workflow.deleteMany()
  await prisma.teamMember.deleteMany()
  await prisma.team.deleteMany()
  await prisma.invite.deleteMany()
  await prisma.user.deleteMany()
  await prisma.rolePermission.deleteMany()
  await prisma.taskField.deleteMany()
  await prisma.boardColumn.deleteMany()
  await prisma.organization.deleteMany()
}

/* ── Основной сценарий ────────────────────────────────────────────────── */

async function main() {
  const existing = await prisma.user.count()
  if (existing > 0 && !FORCE) {
    console.log('В базе уже есть данные. Запустите с --force, чтобы перезаписать.')
    return
  }
  if (existing > 0) {
    console.log('Очищаю базу…')
    await wipe()
  }

  await prisma.organization.create({
    data: { name: 'Норд Софт', unit: 'Продуктовая команда', mark: 'Н' },
  })

  /* Права ролей */
  for (const permission of PERMISSION_KEYS) {
    for (const role of ROLES) {
      await prisma.rolePermission.create({
        data: {
          key: permission.key,
          role,
          allowed: DEFAULT_PERMISSIONS[permission.key]?.includes(role) ?? false,
        },
      })
    }
  }

  /* Поля задачи и колонки доски */
  await prisma.taskField.createMany({
    data: FIELDS.map((f, order) => ({ ...f, order })),
  })
  await prisma.boardColumn.createMany({
    data: BOARD_COLUMNS.map((c) => ({ ...c, statuses: JSON.stringify(c.statuses) })),
  })

  /* Люди */
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  const users = new Map<string, string>()

  for (const [i, p] of PEOPLE.entries()) {
    const palette = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
    const code = codeFrom(p.name)
    const user = await prisma.user.create({
      data: {
        email: p.email,
        passwordHash,
        name: p.name,
        initials: initialsFrom(p.name),
        code,
        role: p.role,
        jobTitle: p.jobTitle,
        avatarBg: palette.bg,
        avatarFg: palette.fg,
        createdAt: day(-120 + i),
      },
    })
    users.set(code, user.id)
  }
  const userId = (code: string | null) => (code ? (users.get(code) ?? null) : null)
  const adminId = users.get('AK')!

  /* Воркфлоу и статусы */
  const statusIds = new Map<string, string>() // "воркфлоу|статус" → id
  for (const name of WORKFLOWS) {
    const workflow = await prisma.workflow.create({ data: { name } })
    for (const [order, s] of STATUSES.entries()) {
      const status = await prisma.status.create({
        data: { workflowId: workflow.id, name: s.name, category: s.category, order },
      })
      statusIds.set(`${name}|${s.name}`, status.id)
    }
    for (const [from, to, condition, role] of TRANSITIONS) {
      await prisma.transition.create({
        data: {
          workflowId: workflow.id,
          fromId: statusIds.get(`${name}|${from}`)!,
          toId: statusIds.get(`${name}|${to}`)!,
          condition,
          role,
        },
      })
    }
  }

  /* Очереди */
  const queues = new Map<string, { id: string; wf: string }>()
  for (const q of QUEUES) {
    const workflow = await prisma.workflow.findUniqueOrThrow({ where: { name: q.wf } })
    const queue = await prisma.queue.create({
      data: {
        key: q.key,
        name: q.name,
        ownerId: userId(q.owner)!,
        workflowId: workflow.id,
        access: q.access,
        createdAt: day(-115),
      },
    })
    queues.set(q.key, { id: queue.id, wf: q.wf })
  }

  /* Проекты и вехи */
  const projects = new Map<string, string>()
  for (const p of PROJECTS) {
    const project = await prisma.project.create({
      data: {
        name: p.name,
        abbr: p.abbr,
        description: p.description,
        queueId: queues.get(p.queue)!.id,
        leadId: userId(p.lead)!,
        state: p.state,
        startDate: day(p.start),
        dueDate: day(p.due),
        createdAt: day(p.start),
      },
    })
    projects.set(p.name, project.id)

    for (const [order, m] of (MILESTONES[p.name] ?? []).entries()) {
      await prisma.milestone.create({
        data: { projectId: project.id, title: m.title, note: m.note, date: day(m.at), state: m.state, order },
      })
    }
  }

  /* Спринты */
  const sprints = new Map<string, string>()
  for (const s of SPRINTS) {
    const sprint = await prisma.sprint.create({
      data: {
        name: s.name,
        queueId: queues.get(s.queue)!.id,
        goal: s.goal ?? '',
        startDate: day(s.start),
        endDate: day(s.end),
        state: s.state,
        capacity: s.capacity,
        createdAt: day(s.start - 3),
      },
    })
    sprints.set(s.name, sprint.id)
  }

  /* Задачи из макета */
  const taskIds = new Map<string, string>()
  const counters = new Map<string, number>()

  for (const t of TASKS) {
    const queue = queues.get(t.queue)!
    const num = Number(t.key.split('-')[1])
    counters.set(t.queue, Math.max(counters.get(t.queue) ?? 0, num))

    const done = t.status === 'Done'
    const task = await prisma.task.create({
      data: {
        key: t.key,
        num,
        queueId: queue.id,
        title: t.title,
        description: t.description ?? '',
        statusId: statusIds.get(`${queue.wf}|${t.status}`)!,
        priority: t.priority,
        assigneeId: userId(t.who),
        authorId: userId(pick(['AK', 'DS', 'MN']))!,
        projectId: t.project ? projects.get(t.project)! : null,
        sprintId: t.sprint ? sprints.get(t.sprint)! : null,
        dueDate: t.due === null ? null : day(t.due, 18),
        estimate: t.est,
        rank: num,
        createdAt: day(t.created, 9 + Math.floor(rand() * 8)),
        closedAt: done ? day(t.due ?? -1, 16) : null,
      },
    })
    taskIds.set(t.key, task.id)

    for (const name of t.tags) {
      const tag = await prisma.tag.upsert({ where: { name }, create: { name }, update: {} })
      await prisma.taskTag.create({ data: { taskId: task.id, tagId: tag.id } })
    }

    const watchers = new Set([task.authorId, ...(task.assigneeId ? [task.assigneeId] : [])])
    for (const w of watchers) await prisma.watcher.create({ data: { taskId: task.id, userId: w } })

    await prisma.activity.create({
      data: {
        taskId: task.id,
        actorId: task.authorId,
        kind: 'created',
        note: `создал(а) задачу в очереди ${t.queue}`,
        createdAt: task.createdAt,
      },
    })
  }

  /* Исторические закрытые задачи — материал для отчётов и графиков. */
  const codes = [...users.keys()]
  const historyPlan: Record<string, number> = { VEKHA: 34, MOB: 18, LMS: 9, SEC: 7, INT: 16, REL: 11 }

  for (const [queueKey, count] of Object.entries(historyPlan)) {
    const queue = queues.get(queueKey)!
    const project = PROJECTS.find((p) => p.queue === queueKey)!
    let num = counters.get(queueKey) ?? 0

    for (let i = 0; i < count; i += 1) {
      num += 1
      // Каждая пятая историческая задача осталась незакрытой: так проекты
      // показывают правдоподобный, а не почти стопроцентный прогресс.
      const open = rand() < 0.22

      const closedAt = day(-Math.floor(rand() * 70) - 1, 11 + Math.floor(rand() * 7))
      const createdAt = open
        ? day(-Math.floor(rand() * 40) - 3, 10)
        : new Date(closedAt.getTime() - (1 + Math.floor(rand() * 9)) * 86_400_000)

      // Примерно каждая пятая закрытая задача не уложилась в срок.
      const slip = rand() < 0.22 ? 1 + Math.floor(rand() * 5) : -Math.floor(rand() * 3)
      const dueDate = open
        ? day(Math.floor(rand() * 40) + 2, 18)
        : new Date(closedAt.getTime() - slip * 86_400_000)

      const status = open ? pick(['New', 'Open', 'Open', 'In Progress', 'Review']) : 'Done'
      const sprintName =
        queueKey === 'VEKHA' && !open ? pick(['Sprint 21', 'Sprint 22', 'Sprint 23']) : null

      await prisma.task.create({
        data: {
          key: `${queueKey}-${num}`,
          num,
          queueId: queue.id,
          title: pick(HISTORY_TITLES),
          statusId: statusIds.get(`${queue.wf}|${status}`)!,
          priority: pick(['low', 'medium', 'medium', 'high']),
          assigneeId: rand() < 0.08 ? null : userId(pick(codes)),
          authorId: userId(pick(codes))!,
          projectId: projects.get(project.name)!,
          sprintId: sprintName ? sprints.get(sprintName)! : null,
          dueDate,
          estimate: pick([1, 2, 3, 3, 5, 5, 8]),
          rank: num,
          createdAt,
          closedAt: open ? null : closedAt,
        },
      })
    }
    counters.set(queueKey, num)
  }

  for (const [key, counter] of counters) {
    await prisma.queue.update({ where: { id: queues.get(key)!.id }, data: { counter } })
  }

  /* Подзадачи и связи для карточки VEKHA-142 */
  const parentId = taskIds.get('VEKHA-142')!
  const parentQueue = queues.get('VEKHA')!
  let subNum = counters.get('VEKHA')!

  const SUBTASKS = [
    { title: 'Собрать карту текущих разделов', status: 'Done', who: 'MN', est: 2, due: -4 },
    { title: 'Три варианта свёрнутого меню', status: 'Done', who: 'MN', est: 3, due: -2 },
    { title: 'Проверить меню на 13-дюймовых экранах', status: 'In Progress', who: 'AK', est: 2, due: 3 },
    { title: 'Скрывать разделы без прав', status: 'New', who: 'PG', est: 1, due: 5 },
  ]

  for (const s of SUBTASKS) {
    subNum += 1
    await prisma.task.create({
      data: {
        key: `VEKHA-${subNum}`,
        num: subNum,
        queueId: parentQueue.id,
        title: s.title,
        statusId: statusIds.get(`Разработка|${s.status}`)!,
        priority: 'medium',
        assigneeId: userId(s.who),
        authorId: adminId,
        projectId: projects.get('Platform Redesign')!,
        sprintId: sprints.get('Sprint 24')!,
        parentId,
        dueDate: day(s.due, 18),
        estimate: s.est,
        rank: subNum,
        createdAt: day(-10),
        closedAt: s.status === 'Done' ? day(s.due, 15) : null,
      },
    })
  }
  await prisma.queue.update({ where: { id: parentQueue.id }, data: { counter: subNum } })

  await prisma.taskLink.create({
    data: { fromId: parentId, toId: taskIds.get('VEKHA-138')!, type: 'blocks' },
  })
  await prisma.taskLink.create({
    data: { fromId: parentId, toId: taskIds.get('VEKHA-129')!, type: 'relates' },
  })
  await prisma.taskLink.create({
    data: { fromId: taskIds.get('LMS-23')!, toId: taskIds.get('LMS-21')!, type: 'blocks' },
  })

  /* Комментарии и история карточки */
  const COMMENTS = [
    {
      key: 'VEKHA-142', who: 'DS', at: day(-1, 18, 24),
      body: 'Проверил старую карту разделов: 14 пунктов, из них 4 ведут на один и тот же список. Предлагаю оставить восемь и вынести администрирование вниз.',
    },
    {
      key: 'VEKHA-142', who: 'MN', at: day(0, 9, 12),
      body: '@anna собрала три варианта левого меню. Свёрнутое состояние нужно проверить на 13-дюймовых экранах — иконки без подписей теряют смысл для новых пользователей.',
    },
    {
      key: 'VEKHA-142', who: 'PG', at: day(0, 10, 5),
      body: 'Учтите права: разделы «Автоматизации» и «Настройки» видны только администраторам очереди, у остальных они должны скрываться, а не блокироваться.',
    },
    {
      key: 'LMS-23', who: 'PG', at: day(-2, 12, 40),
      body: 'Партнёр не отдаёт список групп по API, ждём ответа до конца недели.',
    },
    {
      key: 'VEKHA-141', who: 'DS', at: day(0, 8, 31),
      body: 'Сортировка ломается только при переключении представления — воспроизвёл, чиню.',
    },
    {
      key: 'SEC-12', who: 'EL', at: day(-1, 17, 5),
      body: 'Аудит прав закончен, два замечания по гостевому доступу — нужен вердикт по гостям.',
    },
  ]

  for (const c of COMMENTS) {
    const taskId = taskIds.get(c.key)!
    await prisma.comment.create({
      data: { taskId, authorId: userId(c.who)!, body: c.body, createdAt: c.at, updatedAt: c.at },
    })
    await prisma.activity.create({
      data: {
        taskId,
        actorId: userId(c.who),
        kind: 'comment',
        note: `оставил(а) комментарий: «${c.body.slice(0, 60)}…»`,
        createdAt: c.at,
      },
    })
  }

  const HISTORY = [
    { key: 'VEKHA-142', who: 'AK', kind: 'status', note: 'изменил(а) статус', from: 'Open', to: 'In Progress', at: day(0, 9, 2) },
    { key: 'VEKHA-142', who: 'DS', kind: 'priority', note: 'изменил(а) приоритет', from: 'Medium', to: 'High', at: day(-1, 18, 30) },
    { key: 'VEKHA-142', who: 'AK', kind: 'estimate', note: 'установил(а) оценку 5 SP', at: day(-1, 15, 10) },
    { key: 'VEKHA-142', who: 'PG', kind: 'link', note: 'добавил(а) связь «блокирует VEKHA-138»', at: day(-9, 11, 20) },
    { key: 'VEKHA-138', who: 'DS', kind: 'status', note: 'изменил(а) статус', from: 'In Progress', to: 'Review', at: day(0, 9, 40) },
    { key: 'MOB-84', who: 'IV', kind: 'status', note: 'изменил(а) статус', from: 'Open', to: 'In Progress', at: day(0, 7, 15) },
    { key: 'LMS-23', who: null, kind: 'automation', note: 'подняла приоритет по правилу «Просроченные задачи поднимают приоритет»', at: day(0, 9, 0) },
    { key: 'VEKHA-136', who: 'AK', kind: 'status', note: 'изменил(а) статус', from: 'Testing', to: 'Done', at: day(-8, 16, 0) },
  ]

  for (const h of HISTORY) {
    await prisma.activity.create({
      data: {
        taskId: taskIds.get(h.key)!,
        actorId: userId(h.who ?? null),
        kind: h.kind,
        note: h.note,
        field: h.kind,
        fromValue: h.from ?? '',
        toValue: h.to ?? '',
        createdAt: h.at,
      },
    })
  }

  /* Уведомления для Анны — она открывает приложение первой. */
  const NOTIFICATIONS = [
    { kind: 'mention', actor: 'MN', key: 'VEKHA-142', text: 'Марина упомянула вас в комментарии', at: day(0, 9, 12), read: false },
    { kind: 'status', actor: 'DS', key: 'VEKHA-138', text: 'Дмитрий перевёл задачу в Review', at: day(0, 9, 40), read: false },
    { kind: 'link', actor: 'PG', key: 'LMS-23', text: 'Павел добавил связь «блокирует»', at: day(-1, 11, 20), read: false },
    { kind: 'review', actor: 'EL', key: 'SEC-12', text: 'Елена просит вердикт по гостевому доступу', at: day(-1, 17, 6), read: true },
    { kind: 'comment', actor: 'DS', key: 'VEKHA-141', text: 'Дмитрий прокомментировал задачу', at: day(0, 8, 31), read: false },
  ]

  for (const n of NOTIFICATIONS) {
    await prisma.notification.create({
      data: {
        userId: adminId,
        actorId: userId(n.actor),
        taskId: taskIds.get(n.key)!,
        kind: n.kind,
        text: n.text,
        readAt: n.read ? n.at : null,
        createdAt: n.at,
      },
    })
  }

  /* Команды */
  for (const t of TEAMS) {
    const palette = AVATAR_PALETTE[TEAMS.indexOf(t) % AVATAR_PALETTE.length]
    const team = await prisma.team.create({
      data: { name: t.name, abbr: t.abbr, note: t.note, bg: palette.bg, fg: palette.fg },
    })
    for (const code of t.members) {
      await prisma.teamMember.create({ data: { teamId: team.id, userId: userId(code)! } })
    }
  }

  /* Автоматизации и шаблоны */
  for (const r of RULES) {
    await prisma.automationRule.create({
      data: {
        name: r.name,
        trigger: r.trigger,
        condition: JSON.stringify(r.condition),
        action: JSON.stringify({ actions: r.actions }),
        icon: r.icon,
        iconFg: r.iconFg,
        enabled: r.enabled,
        runCount: r.runs,
        lastRunAt: day(-1, 9),
      },
    })
  }

  for (const t of TEMPLATES) {
    await prisma.taskTemplate.create({
      data: { name: t.name, icon: t.icon, note: t.note, body: t.body, tags: JSON.stringify(t.tags) },
    })
  }

  /* Фильтры */
  for (const f of FILTERS) {
    await prisma.savedFilter.create({ data: { ...f, ownerId: adminId } })
  }

  /* Срезы burndown активного спринта */
  const sprint24Id = sprints.get('Sprint 24')!
  const sprintTasks = await prisma.task.findMany({
    where: { sprintId: sprint24Id },
    include: { status: true },
  })
  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0)
  const spanDays = 21

  for (let i = 0; i <= 10; i += 1) {
    const pointDay = day(-10 + i)
    const ideal = Math.max(0, Math.round(totalPoints * (1 - i / spanDays)))
    // Реальный остаток идёт неровно: команда закрывает задачи рывками.
    const burned = Math.round(totalPoints * (i / spanDays) * (0.55 + rand() * 0.6))
    await prisma.burndownPoint.create({
      data: {
        sprintId: sprint24Id,
        day: pointDay,
        remaining: Math.max(0, totalPoints - Math.min(burned, totalPoints)),
        ideal,
      },
    })
  }

  const totals = {
    люди: await prisma.user.count(),
    очереди: await prisma.queue.count(),
    проекты: await prisma.project.count(),
    задачи: await prisma.task.count(),
    спринты: await prisma.sprint.count(),
    команды: await prisma.team.count(),
  }

  console.log('Готово:', totals)
  console.log(`Вход: anna@nordsoft.ru / ${PASSWORD} (администратор)`)
  console.log('Остальные учётные записи используют тот же пароль.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
