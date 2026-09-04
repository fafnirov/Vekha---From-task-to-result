/**
 * Заводит учётную запись. Запускается на сервере:
 *
 *     node scripts/add-user.mjs почта@пример.ру "Имя Фамилия" [роль]
 *
 * Роль: admin, manager, member или viewer. По умолчанию member.
 *
 * Нужен там, где регистрация закрыта (REGISTRATION=closed): самостоятельно
 * завести учётку нельзя, приглашения не работают, и единственный путь —
 * этот. Пароль скрипт придумывает сам и печатает один раз: в базе остаётся
 * только хеш.
 *
 * Прав сверх имеющихся не даёт: доступ к скрипту равен доступу к серверу,
 * то есть и к самой базе.
 */

import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const ROLES = ['admin', 'manager', 'member', 'viewer']

const AVATARS = [
  { bg: 'var(--ac-soft2)', fg: 'var(--ac-tx)' },
  { bg: 'var(--info-bg)', fg: 'var(--info)' },
  { bg: 'var(--vio-bg)', fg: 'var(--vio)' },
  { bg: 'var(--ok-bg)', fg: 'var(--ok)' },
  { bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  { bg: 'var(--n-bg)', fg: 'var(--tx2)' },
]

const [rawEmail, name, rawRole = 'member'] = process.argv.slice(2)
const email = rawEmail?.trim().toLowerCase()
const role = rawRole.trim().toLowerCase()

function usage(message) {
  console.error(message)
  console.error('')
  console.error('  node scripts/add-user.mjs почта@пример.ру "Имя Фамилия" [admin|manager|member|viewer]')
  process.exit(1)
}

if (!email || !email.includes('@')) usage('Укажите почту.')
if (!name || name.trim().length < 2) usage('Укажите имя — оно видно всей команде.')
if (!ROLES.includes(role)) usage(`Неизвестная роль «${rawRole}». Возможные: ${ROLES.join(', ')}.`)

/** Инициалы для аватара: «Максим Капранов» → «МК». */
function initialsFrom(full) {
  const parts = full.trim().split(/\s+/).slice(0, 2)
  return parts.map((w) => w[0].toUpperCase()).join('')
}

/** Короткий код участника: по нему на человека ссылаются в задачах. */
function codeFrom(full) {
  const parts = full.trim().split(/\s+/).slice(0, 2)
  const latin = { А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'E',Ж:'Z',З:'Z',И:'I',Й:'I',К:'K',Л:'L',М:'M',
    Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',Х:'H',Ц:'C',Ч:'C',Ш:'S',Щ:'S',Ы:'Y',Э:'E',Ю:'U',Я:'Y' }
  return parts
    .map((w) => {
      const c = w[0].toUpperCase()
      return latin[c] ?? c
    })
    .join('')
    .replace(/[^A-Z]/g, '')
    .slice(0, 3) || 'U'
}

const prisma = new PrismaClient()

try {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.error(`Участник с почтой ${email} уже есть: ${existing.name}.`)
    console.error('Сменить ему пароль: node scripts/reset-password.mjs ' + email)
    process.exit(1)
  }

  // Код должен быть свободен: по нему ссылаются на человека в запросах.
  const base = codeFrom(name)
  let code = base
  for (let n = 2; n < 100; n += 1) {
    if (!(await prisma.user.findUnique({ where: { code } }))) break
    code = `${base}${n}`
  }

  const count = await prisma.user.count()
  const palette = AVATARS[count % AVATARS.length]

  // 12 знаков base64url — около 72 бит энтропии.
  const password = randomBytes(9).toString('base64url')

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      name: name.trim(),
      initials: initialsFrom(name),
      code,
      role,
      jobTitle: '',
      avatarBg: palette.bg,
      avatarFg: palette.fg,
    },
  })

  console.log(`Заведён: ${user.name} <${user.email}>`)
  console.log(`Роль: ${user.role}, код: ${user.code}`)
  console.log(`Пароль: ${password}`)
  console.log('Показывается один раз — передайте лично и попросите сменить в «Профиль и пароль».')
} finally {
  await prisma.$disconnect()
}
