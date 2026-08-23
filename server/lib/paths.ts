import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Корень репозитория: server/lib → server → корень. */
export const ROOT = path.resolve(here, '..', '..')

/** Загруженные вложения. Каталог создаётся при первой загрузке. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(ROOT, 'uploads')

/** Собранный фронтенд — его отдаёт сервер в продакшене. */
export const CLIENT_DIR = path.join(ROOT, 'dist')

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/**
 * Префикс за обратным прокси: '' для корня, '/vekha' для раздела.
 * Ведущий слэш добавляется, замыкающий убирается, чтобы склейка
 * `${BASE_PATH}/api/...` всегда давала корректный путь.
 */
export const BASE_PATH = (() => {
  const raw = (process.env.BASE_PATH ?? '').trim().replace(/\/+$/, '')
  if (!raw) return ''
  return raw.startsWith('/') ? raw : `/${raw}`
})()
