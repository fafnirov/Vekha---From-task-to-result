/**
 * Создаёт .env при первой установке.
 *
 * Файл с секретами не хранится в репозитории, поэтому после свежего
 * клонирования его нет — и `prisma migrate` падает на пустом DATABASE_URL.
 * Скрипт берёт .env.example, подставляет случайный JWT_SECRET и сохраняет
 * результат. Существующий .env не трогается никогда.
 */

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, '.env')
const example = path.join(root, '.env.example')

if (existsSync(target)) {
  process.exit(0)
}

if (!existsSync(example)) {
  console.warn('Нет .env.example — пропускаю создание .env')
  process.exit(0)
}

const secret = randomBytes(32).toString('base64url')
const content = readFileSync(example, 'utf8').replace(
  /^JWT_SECRET=.*$/m,
  `JWT_SECRET="${secret}"`,
)

writeFileSync(target, content, 'utf8')
console.log('Создан .env со случайным JWT_SECRET')
