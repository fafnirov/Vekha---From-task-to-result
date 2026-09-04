/**
 * Ограничение попыток входа.
 *
 * Считаем по паре «откуда пришёл запрос + чей адрес почты», а не по
 * одной лишь почте. Прежний ключ — только почта — позволял постороннему
 * закрыть коллеге вход на четверть часа тремя запросами с любым
 * паролем; для рабочей команды это не размен, а готовый способ мешать
 * работать.
 *
 * Настоящий адрес виден потому, что приложение стоит за обратным прокси,
 * а Fastify запущен с `trustProxy`. Порт наружу не открыт, подставить
 * заголовок может только сам прокси.
 *
 * Один ключ по почте всё же остаётся, но с запасом: он ловит перебор,
 * растянутый по многим адресам, и не мешает обычному человеку, который
 * ошибся пару раз с телефона и с ноутбука.
 *
 * Счётчики живут в памяти процесса и обнуляются при перезапуске. Для
 * одного сервера этого достаточно; хранить их в базе значит писать в неё
 * на каждую неудачную попытку.
 */

/** Столько неудач подряд с одной машины допускается до блокировки. */
const LIMIT = 3

/** Столько неудач по одному адресу почты отовсюду сразу. */
const EMAIL_LIMIT = 15

/** На сколько закрывается вход после исчерпания попыток. */
const LOCK_MS = 15 * 60 * 1000

/** Через столько бездействия счётчик неудач забывается сам. */
const FORGET_MS = 15 * 60 * 1000

interface Entry {
  fails: number
  /** Момент, до которого вход закрыт. */
  lockedUntil: number
  touchedAt: number
}

const entries = new Map<string, Entry>()

function prune(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.lockedUntil <= now && now - entry.touchedAt > FORGET_MS) entries.delete(key)
  }
}

/** Ключи, по которым считаются неудачи для одной попытки входа. */
function keysFor(source: string, email: string): { key: string; limit: number }[] {
  return [
    { key: `${source}|${email}`, limit: LIMIT },
    { key: `почта|${email}`, limit: EMAIL_LIMIT },
  ]
}

function lockedForKey(key: string, now: number): number {
  const entry = entries.get(key)
  if (!entry) return 0
  if (entry.lockedUntil > now) return entry.lockedUntil - now
  /*
   * Отбывшая блокировка снимается вместе со счётчиком: иначе первая же
   * ошибка после разблокировки закрыла бы вход снова.
   *
   * Условие `lockedUntil > 0` обязательно. Без него запись стиралась и у
   * того, кто просто ошибся один раз и ещё не заблокирован, — счётчик
   * обнулялся на каждой проверке, и до лимита дело не доходило никогда.
   */
  if (entry.lockedUntil > 0) entries.delete(key)
  return 0
}

/** Сколько миллисекунд осталось до конца блокировки; 0 — вход открыт. */
export function lockedFor(source: string, email: string, now = Date.now()): number {
  let longest = 0
  for (const { key } of keysFor(source, email)) {
    longest = Math.max(longest, lockedForKey(key, now))
  }
  return longest
}

/** Отмечает неудачную попытку и возвращает, сколько их осталось. */
export function registerFailure(source: string, email: string, now = Date.now()): number {
  prune(now)

  let left = LIMIT
  for (const { key, limit } of keysFor(source, email)) {
    const entry = entries.get(key)
    const fresh = !entry || now - entry.touchedAt > FORGET_MS
    const fails = (fresh ? 0 : entry!.fails) + 1

    entries.set(key, {
      fails,
      lockedUntil: fails >= limit ? now + LOCK_MS : 0,
      touchedAt: now,
    })

    left = Math.min(left, Math.max(0, limit - fails))
  }
  return left
}

/** Успешный вход снимает накопленные неудачи. */
export function clearFailures(source: string, email: string): void {
  for (const { key } of keysFor(source, email)) entries.delete(key)
}

/**
 * Снимает блокировку по адресу почты отовсюду. Нужно при сбросе пароля:
 * человека, который забыл пароль и исчерпал попытки, не должна держать
 * блокировка после того, как ему выдали новый.
 */
export function clearEmail(email: string): void {
  for (const key of entries.keys()) {
    if (key.endsWith(`|${email}`)) entries.delete(key)
  }
}

/** Только для тестов и обслуживания. */
export function resetThrottle(): void {
  entries.clear()
}

export const LOGIN_ATTEMPT_LIMIT = LIMIT
