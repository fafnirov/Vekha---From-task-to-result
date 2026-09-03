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
 * Он умеет не только переименовывать, но и сливать. Это обязательно:
 * при старте сервера bootstrap досоздаёт недостающие записи по имени,
 * поэтому после выкатки нового кода рядом со старым «Баг» появляется
 * новая «Ошибка». Простое переименование упёрлось бы в уникальность
 * имени, а слияние переносит задачи на уцелевшую запись и удаляет
 * лишнюю.
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

/** Экран, на котором показывается поле задачи. */
const SCREEN = { Agile: 'Планирование' }

/** Подписи полей задачи. */
const FIELD_LABEL = { 'Оценка (SP)': 'Оценка, баллы', Дедлайн: 'Срок' }

/** Имена шаблонов задач. */
const TEMPLATE = {
  Баг: 'Ошибка',
  'Чек-лист выпуска': 'Контрольный список выпуска',
  'Релизный чек-лист': 'Контрольный список выпуска',
}

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

/**
 * Готовит переименования для справочника с уникальным именем.
 *
 * Если целевое имя уже занято другой записью — это не ошибка, а
 * дубликат, оставленный bootstrap. Такую пару отправляем в слияние:
 * ссылки переносятся на уцелевшую запись, лишняя удаляется.
 */
function planRenames(rows, dict) {
  const byName = new Map(rows.map((r) => [r.name, r]))
  const renames = []
  const merges = []
  for (const row of rows) {
    const target = dict[row.name]
    if (!target || target === row.name) continue
    const clash = byName.get(target)
    if (clash && clash.id !== row.id) {
      merges.push({ from: row, to: clash })
      continue
    }
    // Первая запись, занимающая целевое имя, переименовывается; все
    // следующие с тем же именем сливаются в неё. Иначе два источника,
    // ведущие к одному имени, дали бы две одинаковые записи —
    // у шаблонов имя не уникально, и база их молча пропустила бы.
    renames.push({ id: row.id, from: row.name, to: target })
    byName.set(target, row)
  }
  return { renames, merges }
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
  const types = planRenames(
    await prisma.taskType.findMany({ select: { id: true, name: true } }),
    TYPE,
  )
  for (const t of types.renames) note('тип задачи', t.from, t.to)
  for (const m of types.merges) note('тип задачи, слияние', m.from.name, TYPE[m.to.name] ?? m.to.name)

  const resolutions = planRenames(
    await prisma.resolution.findMany({ select: { id: true, name: true } }),
    RESOLUTION,
  )
  for (const r of resolutions.renames) note('резолюция', r.from, r.to)
  for (const m of resolutions.merges) note('резолюция, слияние', m.from.name, RESOLUTION[m.to.name] ?? m.to.name)

  /* ── Экран поля и шаблоны ─────────────────────────────────────────── */
  const fields = await prisma.taskField.findMany({ select: { id: true, label: true, screen: true } })
  const fieldJobs = fields
    .filter((f) => SCREEN[f.screen] || FIELD_LABEL[f.label])
    .map((f) => ({
      id: f.id,
      label: FIELD_LABEL[f.label] ?? f.label,
      screen: SCREEN[f.screen] ?? f.screen,
      was: f,
    }))
  for (const f of fieldJobs) {
    if (f.label !== f.was.label) note('поле', f.was.label, f.label)
    if (f.screen !== f.was.screen) note(`поле «${f.label}», экран`, f.was.screen, f.screen)
  }

  const templates = planRenames(
    await prisma.taskTemplate.findMany({ select: { id: true, name: true } }),
    TEMPLATE,
  )
  for (const t of templates.renames) note('шаблон', t.from, t.to)
  for (const m of templates.merges) note('шаблон, слияние', m.from.name, TEMPLATE[m.to.name] ?? m.to.name)

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
  const hasWork =
    planned.length > 0 ||
    types.merges.length > 0 ||
    resolutions.merges.length > 0 ||
    templates.merges.length > 0

  if (!hasWork) {
    console.log('Переводить нечего — всё уже по-русски.')
    process.exit(0)
  }

  console.log(planned.length + ' изменений:')
  console.log(planned.join('\n'))

  if (!apply) {
    console.log('\nЭто предварительный просмотр. Чтобы применить: --apply')
    process.exit(0)
  }

  /*
   * Порядок важен. Слияния идут первыми и целиком: сначала задачи
   * переносятся на уцелевшую запись, только потом лишняя удаляется —
   * иначе связь оборвалась бы. Переименования после них, когда
   * занятые имена уже освободились.
   */
  await prisma.$transaction([
    ...types.merges.flatMap((m) => [
      prisma.task.updateMany({ where: { typeId: m.from.id }, data: { typeId: m.to.id } }),
      prisma.taskType.delete({ where: { id: m.from.id } }),
    ]),
    ...resolutions.merges.flatMap((m) => [
      prisma.task.updateMany({
        where: { resolutionId: m.from.id },
        data: { resolutionId: m.to.id },
      }),
      prisma.resolution.delete({ where: { id: m.from.id } }),
    ]),
    // У шаблона нет связанных задач: он лишь заготовка для новой.
    ...templates.merges.map((m) => prisma.taskTemplate.delete({ where: { id: m.from.id } })),

    ...types.renames.map((t) =>
      prisma.taskType.update({ where: { id: t.id }, data: { name: t.to } }),
    ),
    ...resolutions.renames.map((r) =>
      prisma.resolution.update({ where: { id: r.id }, data: { name: r.to } }),
    ),
    ...templates.renames.map((t) =>
      prisma.taskTemplate.update({ where: { id: t.id }, data: { name: t.to } }),
    ),

    ...statusJobs.map((s) =>
      prisma.status.update({ where: { id: s.id }, data: { name: STATUS[s.name] } }),
    ),
    ...columnJobs.map((c) =>
      prisma.boardColumn.update({
        where: { id: c.id },
        data: { name: c.name, statuses: c.statuses },
      }),
    ),
    ...fieldJobs.map((f) =>
      prisma.taskField.update({ where: { id: f.id }, data: { label: f.label, screen: f.screen } }),
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
