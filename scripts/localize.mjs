/**
 * Перевод уже созданных данных на русский. Запускается на сервере:
 *
 *     node scripts/localize.mjs          — показать, что будет изменено
 *     node scripts/localize.mjs --apply  — применить
 *
 * Статусы, колонки доски, типы задач и резолюции хранятся в базе, а не в
 * коде: переименования в исходниках существующую установку не трогают.
 *
 * Скрипт идемпотентен — второй запуск ничего не находит и ничего не
 * делает.
 *
 * Историю задач он не переписывает намеренно. В ней записано, что
 * когда-то произошло: «статус New → Open». Задним числом подменить эти
 * записи значит соврать о прошлом ради единообразия подписей.
 */

import { PrismaClient } from '@prisma/client'

const STATUS = {
  New: 'Новая',
  Open: 'Открыта',
  'In Progress': 'В работе',
  Review: 'На проверке',
  Testing: 'Тестирование',
  Done: 'Готово',
  Blocked: 'Заблокирована',
}

const COLUMN = {
  Backlog: 'Новые',
  'To Do': 'К работе',
  'In Progress': 'В работе',
  Review: 'Проверка',
  Done: 'Готово',
}

const TYPE = { Баг: 'Ошибка' }
const RESOLUTION = { Решён: 'Решена', Отклонён: 'Отклонена' }

const PRIORITY = {
  Critical: 'Критический',
  High: 'Высокий',
  Medium: 'Средний',
  Low: 'Низкий',
}

const apply = process.argv.includes('--apply')
const prisma = new PrismaClient()
const planned = []

function note(what, from, to) {
  planned.push(`  ${what}: «${from}» → «${to}»`)
}

/** Замена целых слов в строке запроса или правила. */
function replaceNames(text, dict) {
  let out = text
  for (const [from, to] of Object.entries(dict)) {
    // Имя может стоять в кавычках, в скобках, после = — но не быть
    // частью другого слова.
    out = out.replaceAll(from, to)
  }
  return out
}

try {
  /* ── Статусы ──────────────────────────────────────────────────────── */
  const statuses = await prisma.status.findMany({ select: { id: true, name: true } })
  const statusJobs = statuses.filter((s) => STATUS[s.name])
  for (const s of statusJobs) note('статус', s.name, STATUS[s.name])

  /* ── Колонки доски ────────────────────────────────────────────────── */
  const columns = await prisma.boardColumn.findMany({ select: { id: true, name: true, statuses: true } })
  const columnJobs = []
  for (const c of columns) {
    const nextName = COLUMN[c.name] ?? c.name
    let list
    try {
      list = JSON.parse(c.statuses)
    } catch {
      list = []
    }
    const nextList = Array.isArray(list) ? list.map((n) => STATUS[n] ?? n) : list
    const changed = nextName !== c.name || JSON.stringify(nextList) !== JSON.stringify(list)
    if (!changed) continue
    columnJobs.push({ id: c.id, name: nextName, statuses: JSON.stringify(nextList) })
    if (nextName !== c.name) note('колонка', c.name, nextName)
    if (JSON.stringify(nextList) !== JSON.stringify(list)) {
      note('  её статусы', list.join(', '), nextList.join(', '))
    }
  }

  /* ── Типы задач и резолюции ───────────────────────────────────────── */
  const types = await prisma.taskType.findMany({ select: { id: true, name: true } })
  const typeJobs = types.filter((t) => TYPE[t.name])
  for (const t of typeJobs) note('тип задачи', t.name, TYPE[t.name])

  const resolutions = await prisma.resolution.findMany({ select: { id: true, name: true } })
  const resolutionJobs = resolutions.filter((r) => RESOLUTION[r.name])
  for (const r of resolutionJobs) note('резолюция', r.name, RESOLUTION[r.name])

  /* ── Сохранённые фильтры ──────────────────────────────────────────── */
  const filters = await prisma.savedFilter.findMany({ select: { id: true, name: true, query: true } })
  const filterJobs = []
  for (const f of filters) {
    const next = replaceNames(replaceNames(f.query, STATUS), PRIORITY)
    if (next === f.query) continue
    filterJobs.push({ id: f.id, query: next })
    note(`фильтр «${f.name}»`, f.query, next)
  }

  /* ── Правила автоматизации ────────────────────────────────────────── */
  const rules = await prisma.automationRule.findMany({
    select: { id: true, name: true, condition: true, action: true },
  })
  const ruleJobs = []
  for (const r of rules) {
    const condition = replaceNames(replaceNames(r.condition, STATUS), PRIORITY)
    const action = replaceNames(replaceNames(r.action, STATUS), PRIORITY)
    if (condition === r.condition && action === r.action) continue
    ruleJobs.push({ id: r.id, condition, action })
    note(`правило «${r.name}»`, 'условия и действия', 'переведены')
  }

  /* ── Отчёт и применение ───────────────────────────────────────────── */
  if (planned.length === 0) {
    console.log('Переводить нечего — всё уже по-русски.')
    process.exit(0)
  }

  console.log(planned.length + ' изменений:')
  console.log(planned.join('\n'))

  if (!apply) {
    console.log('\nЭто предварительный просмотр. Чтобы применить: --apply')
    process.exit(0)
  }

  await prisma.$transaction([
    ...statusJobs.map((s) =>
      prisma.status.update({ where: { id: s.id }, data: { name: STATUS[s.name] } }),
    ),
    ...columnJobs.map((c) =>
      prisma.boardColumn.update({
        where: { id: c.id },
        data: { name: c.name, statuses: c.statuses },
      }),
    ),
    ...typeJobs.map((t) =>
      prisma.taskType.update({ where: { id: t.id }, data: { name: TYPE[t.name] } }),
    ),
    ...resolutionJobs.map((r) =>
      prisma.resolution.update({ where: { id: r.id }, data: { name: RESOLUTION[r.name] } }),
    ),
    ...filterJobs.map((f) =>
      prisma.savedFilter.update({ where: { id: f.id }, data: { query: f.query } }),
    ),
    ...ruleJobs.map((r) =>
      prisma.automationRule.update({
        where: { id: r.id },
        data: { condition: r.condition, action: r.action },
      }),
    ),
  ])

  console.log('\nГотово. История задач не тронута: в ней записано, что было.')
} finally {
  await prisma.$disconnect()
}
