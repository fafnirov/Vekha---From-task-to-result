/**
 * Обязательные поля задачи.
 *
 * Тумблер «Обязательное» на экране настроек полей до сих пор только
 * писался в базу. Здесь он превращается в реальную проверку при
 * создании и изменении задачи.
 *
 * Обязательным можно сделать лишь то, что у задачи действительно есть.
 * Список ниже — единственный источник правды: и проверка, и запрет на
 * включение тумблера у непроверяемого поля смотрят в него.
 */

import { prisma } from './prisma.js'

/** Ключи полей, обязательность которых сервер умеет проверить. */
export const ENFORCEABLE_FIELDS = [
  'title',
  'description',
  'assignee',
  'sprint',
  'estimate',
  'dueDate',
] as const

export type EnforceableField = (typeof ENFORCEABLE_FIELDS)[number]

/** Значения задачи в терминах ключей полей. `undefined` — поле не трогали. */
export type FieldValues = Partial<Record<EnforceableField, unknown>>

function filled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

/**
 * Возвращает названия незаполненных обязательных полей.
 *
 * При создании передаются все значения, поэтому проверяется каждое
 * обязательное поле. При изменении в `values` попадают только те поля,
 * что пришли в запросе: нетронутое поле не должно мешать правке
 * соседнего, а вот очистить обязательное поле нельзя.
 */
export async function missingRequired(values: FieldValues): Promise<string[]> {
  const required = await prisma.taskField.findMany({
    where: { required: true, key: { in: [...ENFORCEABLE_FIELDS] } },
    select: { key: true, label: true },
    orderBy: { order: 'asc' },
  })

  return required
    .filter((field) => field.key in values && !filled(values[field.key as EnforceableField]))
    .map((field) => field.label)
}

/** Готовый ответ 422 с перечислением пропущенных полей. */
export function missingRequiredError(labels: string[]): {
  error: string
  requiredMissing: string[]
} {
  const list = labels.join(', ')
  return {
    error: labels.length === 1 ? `Заполните поле «${list}»` : `Заполните обязательные поля: ${list}`,
    requiredMissing: labels,
  }
}
