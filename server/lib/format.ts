/**
 * Форматирование дат под дизайн: «28 авг», «сегодня, 09:02», «2 ч».
 * Живёт на сервере, чтобы весь интерфейс получал уже готовые подписи
 * и нигде не расходился в написании месяцев.
 */

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

const MONTHS_LONG = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

export const DASH = '—'

/** Полночь по локальному времени — база для сравнения дедлайнов. */
export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime()
  return Math.round(ms / 86_400_000)
}

/** «28 авг». Пустая дата отдаётся длинным тире, как в макете. */
export function shortDate(d: Date | null | undefined): string {
  if (!d) return DASH
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

/** «28 августа» — для вех и подписей в карточках проектов. */
export function longDate(d: Date | null | undefined): string {
  if (!d) return DASH
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`
}

/** «28 авг 2026» — когда год отличается от текущего, иначе «28 авг». */
export function smartDate(d: Date | null | undefined, now = new Date()): string {
  if (!d) return DASH
  const base = shortDate(d)
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/**
 * Состояние дедлайна для подсветки строки: просрочен, истекает сегодня
 * или обычный. Закрытые задачи никогда не считаются просроченными.
 */
export function dueState(
  due: Date | null | undefined,
  closed: boolean,
  now = new Date(),
): 'over' | 'today' | undefined {
  if (!due || closed) return undefined
  const diff = daysBetween(now, due)
  if (diff < 0) return 'over'
  if (diff === 0) return 'today'
  return undefined
}

/** «9 мин», «2 ч», «вчера», «14 авг» — как в ленте активности. */
export function relativeTime(d: Date, now = new Date()): string {
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (sec < 45) return 'только что'
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))} мин`
  const days = daysBetween(d, now)
  if (days === 0) return `${Math.floor(sec / 3600)} ч`
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн`
  return shortDate(d)
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** «сегодня, 09:02» / «вчера, 18:24» / «14 августа» — подписи в истории. */
export function timestampLabel(d: Date, now = new Date()): string {
  const days = daysBetween(d, now)
  if (days === 0) return `сегодня, ${hhmm(d)}`
  if (days === 1) return `вчера, ${hhmm(d)}`
  if (d.getFullYear() === now.getFullYear()) return longDate(d)
  return `${longDate(d)} ${d.getFullYear()}`
}

/** «2 дня», «сегодня», «1 день» — насколько задача просрочена. */
export function overdueLabel(due: Date, now = new Date()): string {
  const late = -daysBetween(now, due)
  if (late <= 0) return 'сегодня'
  return `${late} ${plural(late, 'день', 'дня', 'дней')}`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/** Процент в виде строки «65%» — так его ждут прогресс-бары. */
export function pct(done: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((done / total) * 100)}%`
}

/** Монограмма из имени: «Анна Ковалёва» → «АК». */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const TRANSLIT: Record<string, string> = {
  а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'E', ж: 'Z', з: 'Z',
  и: 'I', й: 'I', к: 'K', л: 'L', м: 'M', н: 'N', о: 'O', п: 'P', р: 'R',
  с: 'S', т: 'T', у: 'U', ф: 'F', х: 'H', ц: 'C', ч: 'C', ш: 'S', щ: 'S',
  ы: 'Y', э: 'E', ю: 'U', я: 'Y',
}

/** Латинский код участника («Анна Ковалёва» → «AK») для ссылок в UI. */
export function codeFrom(name: string): string {
  const letters = initialsFrom(name).toLowerCase().split('')
  return letters.map((c) => TRANSLIT[c] ?? c.toUpperCase()).join('') || 'XX'
}

/** Аббревиатура проекта: «Platform Redesign» → «PR». */
export function abbrFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
