/** Аутентификация, роли и проверка прав. */

import bcrypt from 'bcryptjs'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from './prisma.js'
import { ROLE_RANK, type PermissionKey, type Role } from './constants.js'

export const COOKIE_NAME = 'vekha_token'
const ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export interface SessionUser {
  id: string
  email: string
  name: string
  code: string
  role: Role
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }
    /** req.user заполняется хуком authenticate; в защищённых маршрутах он всегда есть. */
    user: SessionUser
  }
}

/** Кладёт JWT в httpOnly-куку: токен недоступен из JavaScript страницы. */
export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: '/' })
}

/**
 * Хук для защищённых маршрутов: разбирает куку, подтягивает пользователя
 * и обновляет отметку последней активности.
 */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return void reply.code(401).send({ error: 'Требуется вход' })

  let payload: { sub?: string }
  try {
    payload = req.server.jwt.verify<{ sub: string }>(token)
  } catch {
    clearAuthCookie(reply)
    return void reply.code(401).send({ error: 'Сессия истекла' })
  }

  const user = payload.sub
    ? await prisma.user.findUnique({ where: { id: payload.sub } })
    : null

  if (!user || !user.active) {
    clearAuthCookie(reply)
    return void reply.code(401).send({ error: 'Учётная запись недоступна' })
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    code: user.code,
    role: user.role as Role,
  }

  // Отметка активности пишется без ожидания — она не должна тормозить ответ.
  void prisma.user
    .update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined)
}

/** Есть ли у роли право. Матрица редактируется на экране настроек. */
export async function can(role: Role, key: PermissionKey | string): Promise<boolean> {
  const row = await prisma.rolePermission.findUnique({
    where: { key_role: { key, role } },
  })
  return row?.allowed ?? false
}

/** Тот же вопрос, но сразу отвечает 403 и возвращает false. */
export async function require(
  req: FastifyRequest,
  reply: FastifyReply,
  key: PermissionKey | string,
): Promise<boolean> {
  const role = req.user?.role
  if (!role) {
    reply.code(401).send({ error: 'Требуется вход' })
    return false
  }
  if (await can(role, key)) return true
  reply.code(403).send({ error: 'Недостаточно прав' })
  return false
}

export function atLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}

/**
 * Может ли пользователь править конкретную задачу: свои задачи правит автор
 * и исполнитель, чужие — только те, у кого есть task.editForeign.
 */
export async function canEditTask(
  user: SessionUser,
  task: { authorId: string; assigneeId: string | null },
): Promise<boolean> {
  if (task.authorId === user.id || task.assigneeId === user.id) return true
  return can(user.role, 'task.editForeign')
}
