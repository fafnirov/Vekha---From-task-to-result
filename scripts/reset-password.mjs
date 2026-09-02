/**
 * Выдаёт участнику новый пароль. Запускается на сервере.
 *
 *     node scripts/reset-password.mjs почта@пример.ру
 *
 * В интерфейсе то же самое делает админ в «Настройки → Участники». Этот
 * скрипт нужен для случая, когда войти не может уже никто: пароль
 * забыт, второго админа нет, а почты в системе нет и ссылку
 * «восстановить» отправлять некуда.
 *
 * Пароль придумывает скрипт и печатает один раз: в базе остаётся только
 * хеш, прочитать его обратно нельзя — можно лишь выпустить новый.
 *
 * Доступ к этому скрипту равен доступу к серверу, то есть и к самой
 * базе. Ничего сверх того, что уже есть у запускающего, он не даёт.
 */

import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error('Укажите почту: node scripts/reset-password.mjs почта@пример.ру')
  process.exit(1)
}

const prisma = new PrismaClient()

try {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`Участник с почтой ${email} не найден`)
    process.exit(1)
  }

  // 12 знаков base64url — около 72 бит энтропии.
  const password = randomBytes(9).toString('base64url')
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  })

  console.log(`Участник: ${user.name} <${user.email}>, роль ${user.role}`)
  console.log(`Новый пароль: ${password}`)
  console.log('Смените его в «Профиль и пароль» после входа.')
} finally {
  await prisma.$disconnect()
}
