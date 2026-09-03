/**
 * Язык запросов трекера — то, что вводится в конструкторе фильтров:
 *
 *   queue = VEKHA AND status = Review
 *   assignee = currentUser() AND deadline <= endOfWeek()
 *   (priority in (Critical, High) OR tag = bug) AND status != Done
 *
 * Разбор рекурсивным спуском в дерево, затем перевод дерева в `where`
 * для Prisma. Значения нигде не склеиваются в SQL — Prisma параметризует
 * запрос сама, поэтому подстановка из строки безопасна.
 */

import type { Prisma } from '@prisma/client'
import { PRIORITY_FROM_LABEL } from './constants.js'
import { startOfDay } from './format.js'

/* ── Лексер ───────────────────────────────────────────────────────────── */

type TokenType = 'ident' | 'string' | 'op' | 'lparen' | 'rparen' | 'comma' | 'end'

interface Token {
  type: TokenType
  value: string
}

const OPERATORS = ['!=', '<=', '>=', '=', '<', '>', '~']

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    if (/\s/.test(ch)) {
      i += 1
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch })
      i += 1
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch })
      i += 1
      continue
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch })
      i += 1
      continue
    }

    if (ch === '"' || ch === "'") {
      const end = input.indexOf(ch, i + 1)
      const stop = end === -1 ? input.length : end
      tokens.push({ type: 'string', value: input.slice(i + 1, stop) })
      i = stop + 1
      continue
    }

    const op = OPERATORS.find((o) => input.startsWith(o, i))
    if (op) {
      tokens.push({ type: 'op', value: op })
      i += op.length
      continue
    }

    const rest = input.slice(i)
    const match = /^[^\s(),=<>!~]+/.exec(rest)
    if (!match) {
      i += 1
      continue
    }
    tokens.push({ type: 'ident', value: match[0] })
    i += match[0].length
  }

  tokens.push({ type: 'end', value: '' })
  return tokens
}


/* ── Русские имена ────────────────────────────────────────────────────── */

/*
 * Запрос пишется по-русски. Английские написания оставлены рабочими:
 * по ним могли быть сохранены фильтры, и переименование не должно их
 * ломать — а заодно это привычная запись для тех, кто пришёл из других
 * трекеров.
 */

const KEYWORD_ALIAS: Record<string, string> = {
  И: 'AND',
  ИЛИ: 'OR',
  НЕ: 'NOT',
  ИЗ: 'IN',
}

const FIELD_ALIAS: Record<string, string> = {
  очередь: 'queue',
  статус: 'status',
  категория: 'category',
  приоритет: 'priority',
  исполнитель: 'assignee',
  автор: 'author',
  проект: 'project',
  спринт: 'sprint',
  тип: 'type',
  резолюция: 'resolution',
  метка: 'tag',
  метки: 'tags',
  тег: 'tag',
  теги: 'tags',
  наблюдатель: 'watcher',
  оценка: 'estimate',
  срок: 'deadline',
  дедлайн: 'deadline',
  создана: 'created',
  обновлена: 'updated',
  заголовок: 'title',
  текст: 'text',
  ключ: 'key',
  просрочена: 'overdue',
}

const FUNCTION_ALIAS: Record<string, string> = {
  'я()': 'currentuser()',
  'сегодня()': 'today()',
  'сейчас()': 'now()',
  'завтра()': 'tomorrow()',
  'началонедели()': 'startofweek()',
  'конецнедели()': 'endofweek()',
  'конецмесяца()': 'endofmonth()',
}

const CATEGORY_ALIAS: Record<string, string> = {
  готово: 'done',
  'в работе': 'inprogress',
  ожидает: 'todo',
  заблокировано: 'blocked',
}

function categoryKey(value: string): string {
  const lower = value.toLowerCase()
  return CATEGORY_ALIAS[lower] ?? lower
}

/** Приводит написанное по-русски к внутреннему имени. */
export function normalizeKeyword(word: string): string {
  return KEYWORD_ALIAS[word.toUpperCase()] ?? word.toUpperCase()
}

export function normalizeField(word: string): string {
  const lower = word.toLowerCase()
  return FIELD_ALIAS[lower] ?? lower
}

export function normalizeValue(word: string): string {
  const lower = word.toLowerCase()
  return FUNCTION_ALIAS[lower] ?? word
}

/* ── Дерево ───────────────────────────────────────────────────────────── */

type Node =
  | { kind: 'and'; nodes: Node[] }
  | { kind: 'or'; nodes: Node[] }
  | { kind: 'not'; node: Node }
  | { kind: 'cmp'; field: string; op: string; values: string[] }

export class QueryError extends Error {}

class Parser {
  private pos = 0

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private next(): Token {
    return this.tokens[this.pos++]
  }

  private isKeyword(word: string): boolean {
    const t = this.peek()
    return t.type === 'ident' && normalizeKeyword(t.value) === word
  }

  parse(): Node {
    const node = this.parseOr()
    if (this.peek().type !== 'end') {
      throw new QueryError(`Лишний фрагмент: «${this.peek().value}»`)
    }
    return node
  }

  private parseOr(): Node {
    const nodes = [this.parseAnd()]
    while (this.isKeyword('OR')) {
      this.next()
      nodes.push(this.parseAnd())
    }
    return nodes.length === 1 ? nodes[0] : { kind: 'or', nodes }
  }

  private parseAnd(): Node {
    const nodes = [this.parseUnary()]
    while (this.isKeyword('AND')) {
      this.next()
      nodes.push(this.parseUnary())
    }
    return nodes.length === 1 ? nodes[0] : { kind: 'and', nodes }
  }

  private parseUnary(): Node {
    if (this.isKeyword('NOT')) {
      this.next()
      return { kind: 'not', node: this.parseUnary() }
    }
    if (this.peek().type === 'lparen') {
      this.next()
      const inner = this.parseOr()
      if (this.peek().type !== 'rparen') throw new QueryError('Не закрыта скобка')
      this.next()
      return inner
    }
    return this.parseComparison()
  }

  private parseComparison(): Node {
    const fieldToken = this.next()
    if (fieldToken.type !== 'ident') {
      throw new QueryError(`Ожидалось имя поля, получено «${fieldToken.value}»`)
    }
    const field = normalizeField(fieldToken.value)

    // `status in (Review, Testing)` — оператор словом.
    if (this.peek().type === 'ident' && normalizeKeyword(this.peek().value) === 'IN') {
      this.next()
      return { kind: 'cmp', field, op: 'in', values: this.parseList() }
    }

    const opToken = this.next()
    if (opToken.type !== 'op') {
      throw new QueryError(`Ожидался оператор после «${field}»`)
    }

    return { kind: 'cmp', field, op: opToken.value, values: [this.parseValue()] }
  }

  private parseList(): string[] {
    if (this.peek().type !== 'lparen') return [this.parseValue()]
    this.next()
    const values: string[] = []
    while (this.peek().type !== 'rparen' && this.peek().type !== 'end') {
      values.push(this.parseValue())
      if (this.peek().type === 'comma') this.next()
    }
    if (this.peek().type === 'rparen') this.next()
    return values
  }

  private parseValue(): string {
    const token = this.next()
    if (token.type === 'string') return token.value
    if (token.type !== 'ident') throw new QueryError('Ожидалось значение')

    // Вызовы вида currentUser() или endOfWeek() — скобки просто съедаем.
    if (this.peek().type === 'lparen') {
      this.next()
      const args: string[] = []
      while (this.peek().type !== 'rparen' && this.peek().type !== 'end') {
        args.push(this.next().value)
      }
      if (this.peek().type === 'rparen') this.next()
      // Русское имя функции приводится к внутреннему здесь, а не в каждом
      // месте, где значение потом разбирают.
      return normalizeValue(`${token.value}(${args.join(',')})`)
    }
    return token.value
  }
}

/* ── Функции даты и пользователя ──────────────────────────────────────── */

export interface QueryContext {
  userId: string
  userCode: string
  now?: Date
}

function endOfWeek(now: Date): Date {
  const d = startOfDay(now)
  // Неделя считается с понедельника, как в производственном календаре.
  const shift = (7 - ((d.getDay() + 6) % 7) - 1 + 7) % 7
  d.setDate(d.getDate() + shift)
  d.setHours(23, 59, 59, 999)
  return d
}

function startOfWeek(now: Date): Date {
  const d = startOfDay(now)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function resolveDate(raw: string, now: Date): Date | null {
  const value = raw.toLowerCase()
  if (value === 'now()' || value === 'today()') return startOfDay(now)
  if (value === 'endofweek()') return endOfWeek(now)
  if (value === 'startofweek()') return startOfWeek(now)
  if (value === 'endofmonth()') {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    d.setHours(23, 59, 59, 999)
    return d
  }
  if (value === 'tomorrow()') {
    const d = startOfDay(now)
    d.setDate(d.getDate() + 1)
    return d
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isEmptyToken(raw: string): boolean {
  const v = raw.toLowerCase()
  return v === 'пусто()' || v === 'empty()' || v === 'null' || v === 'none' || v === '—'
}

/**
 * Истинность для полей-флагов.
 *
 * Раньше здесь стояло «всё, что не false — истина». С русской записью это
 * стало ловушкой: `просрочена = нет` не равно 'false', то есть молча
 * означало бы «да» — противоположное написанному. Ложные написания
 * перечислены явно, а всё непонятное считается истиной, как и раньше.
 */
function isTruthyToken(raw: string): boolean {
  const v = String(raw).toLowerCase()
  return !(v === 'false' || v === 'нет' || v === '0' || v === 'no')
}

/* ── Перевод в where ──────────────────────────────────────────────────── */

type Where = Prisma.TaskWhereInput

function negate(where: Where): Where {
  return { NOT: where }
}

function compare(node: Extract<Node, { kind: 'cmp' }>, ctx: QueryContext): Where {
  const now = ctx.now ?? new Date()
  const { field, op } = node
  const values = node.values.map((v) =>
    v.toLowerCase() === 'currentuser()' ? ctx.userCode : v,
  )
  const first = values[0] ?? ''
  const negated = op === '!='

  const wrap = (where: Where): Where => (negated ? negate(where) : where)

  switch (field) {
    case 'queue':
      return wrap({ queue: { key: { in: values } } })

    case 'status':
      return wrap({ status: { name: { in: values } } })

    case 'category':
      return wrap({ status: { category: { in: values.map(categoryKey) } } })

    case 'priority': {
      // hasOwn обязателен: без него `priority = constructor` вытащит
      // функцию из прототипа и уронит запрос Prisma в 500.
      const keys = values.map((v) =>
        Object.hasOwn(PRIORITY_FROM_LABEL, v) ? PRIORITY_FROM_LABEL[v] : v.toLowerCase(),
      )
      return wrap({ priority: { in: keys } })
    }

    case 'assignee':
      if (isEmptyToken(first)) return wrap({ assigneeId: null })
      return wrap({ assignee: { OR: [{ code: { in: values } }, { email: { in: values } }] } })

    case 'author':
      return wrap({ author: { OR: [{ code: { in: values } }, { email: { in: values } }] } })

    case 'project':
      if (isEmptyToken(first)) return wrap({ projectId: null })
      return wrap({ project: { name: { in: values } } })

    case 'sprint':
      if (isEmptyToken(first)) return wrap({ sprintId: null })
      return wrap({ sprint: { name: { in: values } } })

    case 'type':
      return wrap({ type: { name: { in: values } } })

    case 'resolution':
      if (isEmptyToken(first)) return wrap({ resolutionId: null })
      return wrap({ resolution: { name: { in: values } } })

    case 'tag':
    case 'tags':
      return wrap({ tags: { some: { tag: { name: { in: values } } } } })

    case 'watcher':
      return wrap({ watchers: { some: { user: { code: { in: values } } } } })

    case 'estimate': {
      const n = Number(first)
      if (Number.isNaN(n)) throw new QueryError(`«${first}» — не число`)
      if (op === '<') return { estimate: { lt: n } }
      if (op === '<=') return { estimate: { lte: n } }
      if (op === '>') return { estimate: { gt: n } }
      if (op === '>=') return { estimate: { gte: n } }
      return wrap({ estimate: n })
    }

    case 'deadline':
    case 'due': {
      if (isEmptyToken(first)) return wrap({ dueDate: null })
      const date = resolveDate(first, now)
      if (!date) throw new QueryError(`«${first}» — не дата`)
      if (op === '<') return { dueDate: { lt: date } }
      if (op === '<=') return { dueDate: { lte: date } }
      if (op === '>') return { dueDate: { gt: date } }
      if (op === '>=') return { dueDate: { gte: date } }
      const dayEnd = new Date(startOfDay(date))
      dayEnd.setHours(23, 59, 59, 999)
      return wrap({ dueDate: { gte: startOfDay(date), lte: dayEnd } })
    }

    case 'created':
    case 'updated': {
      const date = resolveDate(first, now)
      if (!date) throw new QueryError(`«${first}» — не дата`)
      const key = field === 'created' ? 'createdAt' : 'updatedAt'

      if (op === '<') return { [key]: { lt: date } } as Where
      if (op === '<=') return { [key]: { lte: date } } as Where
      if (op === '>') return { [key]: { gt: date } } as Where
      if (op === '>=') return { [key]: { gte: date } } as Where

      // Равенство по дате — это весь день, а не мгновение.
      const dayEnd = new Date(startOfDay(date))
      dayEnd.setHours(23, 59, 59, 999)
      return wrap({ [key]: { gte: startOfDay(date), lte: dayEnd } } as Where)
    }

    case 'text':
    case 'summary':
    case 'title':
      return wrap({
        OR: [{ title: { contains: first } }, { description: { contains: first } }],
      })

    case 'key':
      return wrap({ key: { in: values.map((v) => v.toUpperCase()) } })

    case 'overdue': {
      const today = startOfDay(now)
      const isOverdue: Where = {
        dueDate: { lt: today },
        status: { category: { not: 'done' } },
      }
      /*
       * Противоположность выписана явно, а не через NOT: в SQL сравнение
       * с NULL даёт неопределённость, и задачи без срока выпали бы
       * и из «просроченных», и из «не просроченных».
       */
      const notOverdue: Where = {
        OR: [
          { dueDate: null },
          { dueDate: { gte: today } },
          { status: { category: 'done' } },
        ],
      }
      const wantTrue = isTruthyToken(first)
      const positive = negated ? !wantTrue : wantTrue
      return positive ? isOverdue : notOverdue
    }

    default:
      throw new QueryError(`Неизвестное поле «${field}»`)
  }
}

function toWhere(node: Node, ctx: QueryContext): Where {
  switch (node.kind) {
    case 'and':
      return { AND: node.nodes.map((n) => toWhere(n, ctx)) }
    case 'or':
      return { OR: node.nodes.map((n) => toWhere(n, ctx)) }
    case 'not':
      return negate(toWhere(node.node, ctx))
    case 'cmp':
      return compare(node, ctx)
  }
}

/** Разбирает строку запроса. Пустая строка означает «без ограничений». */
export function parseQuery(input: string, ctx: QueryContext): Where {
  const text = input.trim()
  if (!text) return {}
  const tree = new Parser(tokenize(text)).parse()
  return toWhere(tree, ctx)
}

/** Проверка синтаксиса для подсветки в конструкторе фильтров. */
export function validateQuery(input: string): { ok: true } | { ok: false; error: string } {
  try {
    parseQuery(input, { userId: '', userCode: '' })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Ошибка разбора' }
  }
}
