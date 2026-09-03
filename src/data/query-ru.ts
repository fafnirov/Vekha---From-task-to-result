/**
 * Русские имена для строки запроса.
 *
 * Строку запроса читает и правит человек, поэтому она пишется по-русски.
 * Сервер понимает и английскую запись — по ней могли быть сохранены
 * прежние фильтры, — но собираем мы всегда русскую.
 *
 * Словари вынесены сюда, потому что запрос собирают два экрана:
 * конструктор фильтров и список задач. Пока каждый держал свою копию,
 * список задач писал `assignee = currentUser() AND overdue = true`, а
 * конструктор рядом — `исполнитель = я()`. Один источник избавляет от
 * такого расхождения.
 */

/** Имя поля: внутреннее → показываемое. */
export const FIELD_RU: Record<string, string> = {
  queue: 'очередь',
  status: 'статус',
  category: 'категория',
  priority: 'приоритет',
  assignee: 'исполнитель',
  author: 'автор',
  project: 'проект',
  sprint: 'спринт',
  tag: 'метка',
  type: 'тип',
  resolution: 'резолюция',
  deadline: 'срок',
  due: 'срок',
  estimate: 'оценка',
  text: 'текст',
  title: 'заголовок',
  key: 'ключ',
  watcher: 'наблюдатель',
  overdue: 'просрочена',
  created: 'создана',
  updated: 'обновлена',
}

/**
 * Значение: внутреннее → показываемое.
 *
 * `empty()` переводится в «пусто()» — это написание сервер принимает
 * наравне с английским.
 */
export const VALUE_RU: Record<string, string> = {
  'currentUser()': 'я()',
  'now()': 'сейчас()',
  'today()': 'сегодня()',
  'tomorrow()': 'завтра()',
  'startOfWeek()': 'началоНедели()',
  'endOfWeek()': 'конецНедели()',
  'endOfMonth()': 'конецМесяца()',
  'empty()': 'пусто()',
  'true': 'да',
  'false': 'нет',
  done: 'готово',
  inprogress: 'в работе',
  todo: 'ожидает',
  blocked: 'заблокировано',
}

export function fieldRu(key: string): string {
  return FIELD_RU[key] ?? key
}

export function valueRu(value: string): string {
  return VALUE_RU[value] ?? value
}

/** Список значений через запятую — каждое переводится отдельно. */
export function valuesRu(list: string): string {
  return list
    .split(',')
    .map((v) => valueRu(v.trim()))
    .join(', ')
}
