/** Регистрация, вход, приглашения. */

import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import {
  authenticate,
  clearAuthCookie,
  hashPassword,
  require as requirePerm,
  setAuthCookie,
  verifyPassword,
} from '../lib/auth.js'
import { AVATAR_PALETTE, ROLES, type Role } from '../lib/constants.js'
import { codeFrom, initialsFrom } from '../lib/format.js'
import { personDto } from '../lib/dto.js'
import { clearFailures, lockedFor, registerFailure } from '../lib/throttle.js'
import { emitChange } from '../lib/events.js'

/**
 * Режим регистрации.
 *
 *   invite  — по приглашению (по умолчанию): первый вошедший становится
 *             админом, остальные заводятся по ссылке-приглашению
 *   closed  — самостоятельной регистрации нет вовсе, учётки заводит
 *             владелец сервера командой scripts/add-user.mjs
 *
 * Закрытый режим нужен там, где трекер стоит на общей машине и лишний
 * путь к созданию учётной записи — лишний риск.
 */
const REGISTRATION_CLOSED = (process.env.REGISTRATION ?? 'invite').toLowerCase() === 'closed'

const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный адрес почты'),
  password: z.string().min(8, 'Пароль короче восьми символов'),
})

const registration = credentials.extend({
  name: z.string().trim().min(2, 'Укажите имя'),
  jobTitle: z.string().trim().max(60).optional(),
  /** Токен приглашения; без него регистрируется только первый пользователь. */
  invite: z.string().trim().optional(),
})

/** Свободный код участника: AK, AK2, AK3 … */
async function uniqueCode(name: string): Promise<string> {
  const base = codeFrom(name)
  for (let n = 0; n < 100; n += 1) {
    const candidate = n === 0 ? base : `${base}${n + 1}`
    const taken = await prisma.user.findUnique({ where: { code: candidate } })
    if (!taken) return candidate
  }
  return randomBytes(3).toString('hex').toUpperCase()
}

async function nextPalette(): Promise<{ bg: string; fg: string }> {
  const count = await prisma.user.count()
  return AVATAR_PALETTE[count % AVATAR_PALETTE.length]
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** Есть ли вообще учётные записи — от этого зависит первый экран. */
  app.get('/api/auth/state', async () => {
    const users = await prisma.user.count()
    const org = await prisma.organization.findFirst()
    return {
      initialized: users > 0,
      registrationClosed: REGISTRATION_CLOSED,
      org: org ? { name: org.name, unit: org.unit, mark: org.mark } : null,
    }
  })

  app.post('/api/auth/register', async (req, reply) => {
    if (REGISTRATION_CLOSED) {
      return reply.code(403).send({
        error: 'Регистрация закрыта. Учётную запись заводит администратор.',
      })
    }

    const parsed = registration.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }
    const { email, password, name, jobTitle, invite } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'Такая почта уже зарегистрирована' })

    const userCount = await prisma.user.count()
    let role: Role = 'admin'
    let inviteRow = null

    if (userCount > 0) {
      if (!invite) {
        return reply.code(403).send({ error: 'Регистрация возможна только по приглашению' })
      }
      inviteRow = await prisma.invite.findUnique({ where: { token: invite } })
      if (!inviteRow || inviteRow.acceptedAt || inviteRow.expiresAt < new Date()) {
        return reply.code(403).send({ error: 'Приглашение недействительно или истекло' })
      }
      if (inviteRow.email.toLowerCase() !== email) {
        return reply.code(403).send({ error: 'Приглашение выписано на другой адрес' })
      }
      role = inviteRow.role as Role
    }

    const palette = await nextPalette()
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        name,
        initials: initialsFrom(name),
        code: await uniqueCode(name),
        role,
        jobTitle: jobTitle ?? '',
        avatarBg: palette.bg,
        avatarFg: palette.fg,
      },
    })

    if (inviteRow) {
      await prisma.invite.update({
        where: { id: inviteRow.id },
        data: { acceptedAt: new Date() },
      })
    }

    setAuthCookie(reply, app.jwt.sign({ sub: user.id }, { expiresIn: '30d' }))
    emitChange({ scope: 'people' })
    return { user: personDto(user), firstUser: userCount === 0 }
  })

  app.post('/api/auth/login', async (req, reply) => {
    const parsed = credentials.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Введите почту и пароль' })
    }
    const { email, password } = parsed.data

    // Блокировка проверяется до обращения к базе: пока вход закрыт, пароль
    // не сверяется вовсе.
    const locked = lockedFor(email)
    if (locked > 0) {
      const minutes = Math.ceil(locked / 60000)
      return reply.code(429).send({
        error: `Слишком много попыток входа. Повторите через ${minutes} мин.`,
        retryAfter: Math.ceil(locked / 1000),
      })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    // Одинаковый ответ на неизвестную почту и неверный пароль — чтобы по
    // ответу нельзя было перебирать существующие адреса.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      const left = registerFailure(email)
      return reply.code(left > 0 ? 401 : 429).send({
        error:
          left > 0
            ? `Неверная почта или пароль. Осталось попыток: ${left}`
            : `Неверная почта или пароль. Попытки исчерпаны, вход закрыт на 15 минут.`,
        attemptsLeft: left,
      })
    }
    if (!user.active) {
      return reply.code(403).send({ error: 'Учётная запись отключена' })
    }

    clearFailures(email)
    setAuthCookie(reply, app.jwt.sign({ sub: user.id }, { expiresIn: '30d' }))
    return { user: personDto(user) }
  })

  app.post('/api/auth/logout', async (_req, reply) => {
    clearAuthCookie(reply)
    return { ok: true }
  })

  app.get('/api/auth/me', { preHandler: authenticate }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    return { user: personDto(user) }
  })

  app.patch('/api/auth/me', { preHandler: authenticate }, async (req, reply) => {
    const schema = z.object({
      name: z.string().trim().min(2).optional(),
      jobTitle: z.string().trim().max(60).optional(),
      password: z.string().min(8).optional(),
      currentPassword: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректные данные' })

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    const data: Record<string, unknown> = {}

    if (parsed.data.name) {
      data.name = parsed.data.name
      data.initials = initialsFrom(parsed.data.name)
    }
    if (parsed.data.jobTitle !== undefined) data.jobTitle = parsed.data.jobTitle

    if (parsed.data.password) {
      const ok =
        parsed.data.currentPassword &&
        (await verifyPassword(parsed.data.currentPassword, me.passwordHash))
      if (!ok) return reply.code(403).send({ error: 'Текущий пароль указан неверно' })
      data.passwordHash = await hashPassword(parsed.data.password)
    }

    const user = await prisma.user.update({ where: { id: me.id }, data })
    emitChange({ scope: 'people' })
    return { user: personDto(user) }
  })

  /* ── Приглашения ────────────────────────────────────────────────────── */

  app.get('/api/invites', { preHandler: authenticate }, async (req, reply) => {
    if (!(await requirePerm(req, reply, 'people.manage'))) return
    const invites = await prisma.invite.findMany({
      where: { acceptedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true } } },
    })
    return invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token,
      expiresAt: i.expiresAt.toISOString(),
      createdBy: i.createdBy.name,
      expired: i.expiresAt < new Date(),
    }))
  })

  app.post('/api/invites', { preHandler: authenticate }, async (req, reply) => {
    if (!(await requirePerm(req, reply, 'people.manage'))) return
    if (REGISTRATION_CLOSED) {
      // Выдать ссылку, по которой нельзя зарегистрироваться, — обмануть.
      return reply.code(409).send({
        error: 'Регистрация закрыта: приглашение работать не будет. Учётную запись заводит администратор на сервере.',
      })
    }

    const schema = z.object({
      email: z.string().trim().toLowerCase().email('Некорректный адрес почты'),
      role: z.enum(ROLES).default('member'),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }

    const taken = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (taken) return reply.code(409).send({ error: 'Этот человек уже в организации' })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14)

    const invite = await prisma.invite.create({
      data: {
        email: parsed.data.email,
        role: parsed.data.role,
        token: randomBytes(24).toString('base64url'),
        expiresAt,
        createdById: req.user!.id,
      },
    })

    // Почта не отправляется: ссылку показываем в интерфейсе, чтобы приложение
    // не зависело от SMTP и работало сразу после установки.
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
    }
  })

  app.delete('/api/invites/:id', { preHandler: authenticate }, async (req, reply) => {
    if (!(await requirePerm(req, reply, 'people.manage'))) return
    const { id } = req.params as { id: string }
    await prisma.invite.delete({ where: { id } }).catch(() => undefined)
    return { ok: true }
  })

  /** Публичная проверка ссылки-приглашения на экране регистрации. */
  app.get('/api/invites/check/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    const invite = await prisma.invite.findUnique({ where: { token } })
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return reply.code(404).send({ error: 'Приглашение недействительно' })
    }
    return { email: invite.email, role: invite.role }
  })
}
