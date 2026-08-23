/**
 * Приведение базы к рабочему минимуму при старте сервера.
 *
 * Выполняется всегда и ничего не перезаписывает: только добавляет
 * недостающее. Благодаря этому и чистая установка, и база, из которой
 * удалили демонстрационные данные, поднимаются работоспособными —
 * без прав администратор не смог бы даже создать задачу.
 */

import { prisma } from './lib/prisma.js'
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS, ROLES } from './lib/constants.js'
import {
  DEFAULT_BOARD_COLUMNS,
  DEFAULT_FIELDS,
  DEFAULT_STATUSES,
  DEFAULT_TEMPLATES,
  DEFAULT_TRANSITIONS,
  DEFAULT_WORKFLOW,
} from './lib/defaults.js'

/** Добавляет только отсутствующие права: правки в настройках сохраняются. */
async function ensurePermissions(): Promise<number> {
  const existing = await prisma.rolePermission.findMany({ select: { key: true, role: true } })
  const have = new Set(existing.map((r) => `${r.key}|${r.role}`))

  const missing = []
  for (const permission of PERMISSION_KEYS) {
    for (const role of ROLES) {
      if (have.has(`${permission.key}|${role}`)) continue
      missing.push({
        key: permission.key,
        role,
        allowed: DEFAULT_PERMISSIONS[permission.key]?.includes(role) ?? false,
      })
    }
  }

  if (missing.length) await prisma.rolePermission.createMany({ data: missing })
  return missing.length
}

async function ensureFields(): Promise<number> {
  const existing = await prisma.taskField.findMany({ select: { key: true } })
  const have = new Set(existing.map((f) => f.key))

  const missing = DEFAULT_FIELDS.filter((f) => !have.has(f.key)).map((f, i) => ({
    ...f,
    order: existing.length + i,
  }))

  if (missing.length) await prisma.taskField.createMany({ data: missing })
  return missing.length
}

async function ensureBoardColumns(): Promise<number> {
  // Колонки правятся в настройках, поэтому восстанавливаем их только
  // когда доски нет вовсе — иначе вернём удалённую колонку.
  const count = await prisma.boardColumn.count()
  if (count > 0) return 0

  await prisma.boardColumn.createMany({
    data: DEFAULT_BOARD_COLUMNS.map((c) => ({
      name: c.name,
      statuses: JSON.stringify(c.statuses),
      wipLimit: c.wipLimit,
      order: c.order,
    })),
  })
  return DEFAULT_BOARD_COLUMNS.length
}

async function ensureWorkflow(): Promise<boolean> {
  const count = await prisma.workflow.count()
  if (count > 0) return false

  const workflow = await prisma.workflow.create({ data: { name: DEFAULT_WORKFLOW } })

  const ids = new Map<string, string>()
  for (const [order, s] of DEFAULT_STATUSES.entries()) {
    const status = await prisma.status.create({
      data: { workflowId: workflow.id, name: s.name, category: s.category, order },
    })
    ids.set(s.name, status.id)
  }

  for (const [from, to, condition, role] of DEFAULT_TRANSITIONS) {
    const fromId = ids.get(from)
    const toId = ids.get(to)
    if (!fromId || !toId) continue
    await prisma.transition.create({
      data: { workflowId: workflow.id, fromId, toId, condition, role },
    })
  }

  return true
}

async function ensureOrganization(): Promise<boolean> {
  const count = await prisma.organization.count()
  if (count > 0) return false
  await prisma.organization.create({
    data: { name: 'Организация', unit: '', mark: 'О' },
  })
  return true
}

async function ensureTemplates(): Promise<number> {
  const count = await prisma.taskTemplate.count()
  if (count > 0) return 0

  await prisma.taskTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((t) => ({
      name: t.name,
      icon: t.icon,
      note: t.note,
      body: t.body,
      tags: JSON.stringify(t.tags),
    })),
  })
  return DEFAULT_TEMPLATES.length
}

export async function bootstrap(): Promise<void> {
  const added: string[] = []

  if (await ensureOrganization()) added.push('организация')
  if (await ensureWorkflow()) added.push(`воркфлоу «${DEFAULT_WORKFLOW}»`)

  const permissions = await ensurePermissions()
  if (permissions) added.push(`права (${permissions})`)

  const fields = await ensureFields()
  if (fields) added.push(`поля задачи (${fields})`)

  const columns = await ensureBoardColumns()
  if (columns) added.push(`колонки доски (${columns})`)

  const templates = await ensureTemplates()
  if (templates) added.push(`шаблоны (${templates})`)

  if (added.length) {
    console.log(`Создано недостающее: ${added.join(', ')}`)
  }
}
