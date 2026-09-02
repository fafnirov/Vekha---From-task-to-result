/**
 * Ограничение попыток входа.
 *
 * Считаем по адресу почты, а не по IP: приложение стоит за обратным
 * прокси и без `trustProxy` все запросы приходят с одного адреса —
 * блокировка по IP выключила бы вход сразу всем.
 *
 * Обратная сторона выбранного ключа: чужой человек может намеренно
 * заблокировать известный ему адрес на четверть часа. Это осознанный
 * размен — перебор пароля вреднее, а владелец адреса просто ждёт.
 *
 * Счётчик живёт в памяти процесса и обнуляется при перезапуске. Для
 * одного сервера этого достаточно; хранить его в базе значит писать
 * в неё на каждую неудачную попытку.
 */

/** Столько неудач подряд допускается до блокировки. */
const LIMIT = 3

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

/** Сколько миллисекунд осталось до конца блокировки; 0 — вход открыт. */
export function lockedFor(key: string, now = Date.now()): number {
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

/** Отмечает неудачную попытку и возвращает, сколько их осталось. */
export function registerFailure(key: string, now = Date.now()): number {
  prune(now)

  const entry = entries.get(key)
  const fresh = !entry || now - entry.touchedAt > FORGET_MS
  const fails = (fresh ? 0 : entry!.fails) + 1

  entries.set(key, {
    fails,
    lockedUntil: fails >= LIMIT ? now + LOCK_MS : 0,
    touchedAt: now,
  })

  return Math.max(0, LIMIT - fails)
}

/** Успешный вход снимает накопленные неудачи. */
export function clearFailures(key: string): void {
  entries.delete(key)
}

/** Только для тестов и обслуживания. */
export function resetThrottle(): void {
  entries.clear()
}

export const LOGIN_ATTEMPT_LIMIT = LIMIT
