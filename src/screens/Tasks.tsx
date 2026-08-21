import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Checkbox,
  Empty,
  Icon,
  PriorityChip,
  StatusBadge,
  Tag,
  TaskKey,
} from '../components/ui'
import { PEOPLE, PRIORITY_ORDER, dueColor } from '../data/catalog'
import { TASKS, TOTAL_TASKS } from '../data/tasks'
import type { Task } from '../data/types'
import { useApp } from '../store/app'

type ViewName = 'Все задачи' | 'Мои' | 'Срочно' | 'Sprint 24' | 'Без спринта'
type SortKey =
  | 'key'
  | 'title'
  | 'status'
  | 'priority'
  | 'who'
  | 'project'
  | 'sprint'
  | 'due'
  | 'est'

const VIEWS: ViewName[] = ['Все задачи', 'Мои', 'Срочно', 'Sprint 24', 'Без спринта']

const VIEW_FILTERS: Record<ViewName, (t: Task) => boolean> = {
  'Все задачи': () => true,
  Мои: (t) => t.who === 'AK',
  Срочно: (t) => t.priority === 'Critical' || Boolean(t.dueState),
  'Sprint 24': (t) => t.sprint === 'Sprint 24',
  'Без спринта': (t) => t.sprint === '—',
}

const OPTIONAL_COLS = {
  project: 'Проект',
  sprint: 'Спринт',
  due: 'Дедлайн',
  est: 'SP',
} as const

type OptionalCol = keyof typeof OPTIONAL_COLS

const BULK_ACTIONS = [
  { label: 'Статус', icon: 'sync_alt', text: '→ In Progress' },
  { label: 'Назначить', icon: 'person_add', text: 'Марина Нестерова' },
  { label: 'Приоритет', icon: 'keyboard_arrow_up', text: '→ High' },
  { label: 'Тег', icon: 'sell', text: 'frontend' },
  { label: 'Переместить', icon: 'move_down', text: 'Выберите очередь в диалоге' },
  { label: 'В спринт', icon: 'rotate_right', text: 'Sprint 25' },
  { label: 'Удалить', icon: 'delete', text: 'Удаление доступно администратору' },
]

const SKELETON_WIDTHS = ['72%', '54%', '63%', '48%', '80%', '58%', '66%', '44%']

export function Tasks() {
  const nav = useNavigate()
  const { statusOf, toast } = useApp()

  const [view, setView] = useState<ViewName>('Все задачи')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('key')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [sel, setSel] = useState<string[]>([])
  const [cols, setCols] = useState<Record<OptionalCol, boolean>>({
    project: true,
    sprint: true,
    due: true,
    est: true,
  })
  const [colsOpen, setColsOpen] = useState(false)
  const [titleW, setTitleW] = useState(420)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [groupBy, setGroupBy] = useState<'нет' | 'по статусу'>('нет')
  const [chips, setChips] = useState([
    { k: 'Очередь:', v: 'VEKHA' },
    { k: 'Статус:', v: 'открытые' },
    { k: 'Спринт:', v: 'Sprint 24' },
  ])

  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const setViewWithLoad = (v: ViewName) => {
    setView(v)
    setSel([])
    setLoading(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setLoading(false), 420)
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = TASKS.filter(VIEW_FILTERS[view]).filter(
      (t) => !q || `${t.title} ${t.key} ${t.project}`.toLowerCase().includes(q),
    )
    const cmp: Record<SortKey, (a: Task, b: Task) => number> = {
      key: (a, b) => a.key.localeCompare(b.key),
      title: (a, b) => a.title.localeCompare(b.title),
      status: (a, b) => statusOf(a.key).localeCompare(statusOf(b.key)),
      priority: (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      who: (a, b) => PEOPLE[a.who].name.localeCompare(PEOPLE[b.who].name),
      project: (a, b) => a.project.localeCompare(b.project),
      sprint: (a, b) => a.sprint.localeCompare(b.sprint),
      due: (a, b) => a.due.localeCompare(b.due),
      est: (a, b) => a.est - b.est,
    }
    const sorted = [...list].sort(cmp[sortKey])
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [view, query, sortKey, sortDir, statusOf])

  const on = (k: OptionalCol) => cols[k]

  const gridCols = useMemo(() => {
    const w = ['32px', '88px', `minmax(0,${titleW}px)`, '124px', '32px', '32px']
    if (on('project')) w.push('138px')
    if (on('sprint')) w.push('90px')
    if (on('due')) w.push('78px')
    if (on('est')) w.push('46px')
    return w.join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleW, cols])

  const gridMin = useMemo(() => {
    const base =
      340 +
      titleW +
      (on('project') ? 138 : 0) +
      (on('sprint') ? 90 : 0) +
      (on('due') ? 78 : 0) +
      (on('est') ? 46 : 0)
    return `${base + 80}px`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleW, cols])

  const columns = useMemo(() => {
    const all: { label: string; k: SortKey; just?: string; optional?: OptionalCol }[] = [
      { label: 'Ключ', k: 'key' },
      { label: 'Задача', k: 'title' },
      { label: 'Статус', k: 'status' },
      { label: 'Пр.', k: 'priority', just: 'center' },
      { label: 'Исп.', k: 'who', just: 'center' },
      { label: 'Проект', k: 'project', optional: 'project' },
      { label: 'Спринт', k: 'sprint', optional: 'sprint' },
      { label: 'Дедлайн', k: 'due', optional: 'due' },
      { label: 'SP', k: 'est', just: 'flex-end', optional: 'est' },
    ]
    return all.filter((c) => !c.optional || cols[c.optional])
  }, [cols])

  const allOn = rows.length > 0 && sel.length === rows.length

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX
    const w0 = titleW
    const move = (ev: MouseEvent) =>
      setTitleW(Math.max(220, Math.min(760, w0 + ev.clientX - x0)))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const sortBy = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--workspace)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 16px 0' }}
        >
          <div className="page__title" style={{ marginRight: 10 }}>
            Задачи
          </div>
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              className={v === view ? 'tab tab--on' : 'tab'}
              style={{ height: 28, padding: '0 10px' }}
              onClick={() => setViewWithLoad(v)}
            >
              {v}
              <span className="tab__underline" style={{ bottom: -1 }} />
            </button>
          ))}
          <button
            type="button"
            className="btn btn--dashed btn--sm"
            style={{ marginLeft: 6 }}
            onClick={() => toast('Представление сохранено', `«${view}» доступно команде`)}
          >
            <Icon name="bookmark_add" size={15} />
            Сохранить
          </button>
          <div className="spacer" style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn--icon"
              title="Вид: доска"
              onClick={() => nav('/board')}
            >
              <Icon name="view_kanban" size={17} />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn--secondary"
                style={
                  colsOpen
                    ? {
                        background: 'var(--ac-soft)',
                        borderColor: 'var(--ac-soft2)',
                        color: 'var(--ac-tx)',
                      }
                    : undefined
                }
                onClick={() => setColsOpen(!colsOpen)}
              >
                <Icon name="view_column" size={16} />
                Колонки
              </button>
              {colsOpen && (
                <div className="menu" style={{ top: 32, right: 0, width: 212 }}>
                  <div className="vk-eyebrow" style={{ padding: '5px 8px 6px' }}>
                    Отображать колонки
                  </div>
                  {(Object.keys(OPTIONAL_COLS) as OptionalCol[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="menu__item"
                      onClick={() => setCols({ ...cols, [k]: !cols[k] })}
                    >
                      <Checkbox
                        on={cols[k]}
                        onClick={() => setCols({ ...cols, [k]: !cols[k] })}
                        label={OPTIONAL_COLS[k]}
                      />
                      <span style={{ flex: 1 }}>{OPTIONAL_COLS[k]}</span>
                      <span className="menu__kb">{cols[k] ? 'вкл' : 'выкл'}</span>
                    </button>
                  ))}
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--tx3)',
                      padding: '6px 8px 4px',
                      borderTop: '1px solid var(--border)',
                      marginTop: 4,
                    }}
                  >
                    Набор колонок и их ширина сохраняются для вашего профиля
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn--icon"
              title="Экспорт"
              onClick={() => toast('Экспорт', 'Файл XLSX будет готов через минуту', 'info')}
            >
              <Icon name="download" size={17} />
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 16px 10px',
            flexWrap: 'wrap',
          }}
        >
          <div className="field" style={{ width: 238 }}>
            <Icon name="search" size={16} color="var(--tx3)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Быстрый поиск"
              aria-label="Быстрый поиск по задачам"
            />
          </div>
          {chips.map((c, i) => (
            <div key={c.k + c.v} className="chip">
              <span className="chip__k">{c.k}</span>
              <span className="chip__v">{c.v}</span>
              <button
                type="button"
                className="chip__x"
                aria-label={`Убрать фильтр ${c.k} ${c.v}`}
                onClick={() => setChips(chips.filter((_, j) => j !== i))}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn--dashed"
            onClick={() => setChips([...chips, { k: 'Тег:', v: 'frontend' }])}
          >
            <Icon name="add" size={15} />
            Фильтр
          </button>
          <div
            className="spacer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--tx2)',
            }}
          >
            <span className="mono">{rows.length}</span> задач
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setGroupBy(groupBy === 'нет' ? 'по статусу' : 'нет')}
            >
              <Icon name="segment" size={15} />
              Группировка: {groupBy}
            </button>
          </div>
        </div>

        {sel.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: 'var(--ac-soft)',
              borderTop: '1px solid var(--ac-soft2)',
              animation: 'vk-pop 160ms cubic-bezier(.2,.8,.3,1)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ac-tx)' }}>
              Выбрано: {sel.length}
            </span>
            <div style={{ width: 1, height: 16, background: 'var(--ac-soft2)' }} />
            {BULK_ACTIONS.map((b) => (
              <button
                key={b.label}
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() =>
                  b.label === 'Удалить'
                    ? toast('Требуется подтверждение', b.text, 'warn')
                    : toast(`${b.label}: ${sel.length} задач`, b.text)
                }
              >
                <Icon name={b.icon} size={15} />
                {b.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn--quiet spacer"
              onClick={() => setSel([])}
            >
              Снять выделение
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 26px' }}>
        <div className="card" style={{ overflowX: 'auto', marginTop: 12 }}>
          <div className="thead" style={{ gridTemplateColumns: gridCols, minWidth: gridMin }}>
            <Checkbox
              small
              on={allOn}
              onClick={() => setSel(allOn ? [] : rows.map((t) => t.key))}
              label="Выбрать все задачи"
            />
            {columns.map((c) => (
              <div
                key={c.k}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: c.just ?? 'flex-start',
                  minWidth: 0,
                }}
              >
                <button
                  type="button"
                  className={sortKey === c.k ? 'th th--on' : 'th'}
                  title={`Сортировать по «${c.label}»`}
                  onClick={() => sortBy(c.k)}
                >
                  {c.label}
                  <span className="ic th__arrow">
                    {sortKey === c.k && sortDir === 'desc'
                      ? 'arrow_downward'
                      : 'arrow_upward'}
                  </span>
                </button>
                {c.k === 'title' && (
                  <span
                    className="th-resize"
                    onMouseDown={startResize}
                    title="Потяните, чтобы изменить ширину"
                  />
                )}
              </div>
            ))}
          </div>

          {loading &&
            SKELETON_WIDTHS.map((w, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 88px minmax(0,1fr) 124px 200px',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 12px',
                  height: 'var(--rowh)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--n-bg)' }}
                />
                <div className="skel" style={{ width: 64 }} />
                <div className="skel" style={{ width: w }} />
                <div
                  style={{ height: 16, width: 82, borderRadius: 5, background: 'var(--n-bg)' }}
                />
                <div
                  style={{ height: 9, width: 150, borderRadius: 4, background: 'var(--n-bg)' }}
                />
              </div>
            ))}

          {!loading &&
            rows.map((t) => {
              const selected = sel.includes(t.key)
              return (
                <div
                  key={t.key}
                  className={selected ? 'row row--on' : 'row'}
                  style={{
                    gridTemplateColumns: gridCols,
                    minWidth: gridMin,
                    gap: 8,
                    padding: '0 12px',
                  }}
                  onClick={() => nav(`/tasks/${t.key}`)}
                >
                  <Checkbox
                    small
                    on={selected}
                    label={`Выбрать ${t.key}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSel(
                        selected ? sel.filter((k) => k !== t.key) : [...sel, t.key],
                      )
                    }}
                  />
                  <TaskKey>{t.key}</TaskKey>
                  <span
                    style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}
                  >
                    <span className="ellipsis" style={{ fontSize: 12.5 }}>
                      {t.title}
                    </span>
                    {t.tags.slice(0, 2).map((tg) => (
                      <Tag key={tg}>{tg}</Tag>
                    ))}
                  </span>
                  <StatusBadge status={statusOf(t.key)} />
                  <span style={{ justifySelf: 'center' }}>
                    <PriorityChip priority={t.priority} />
                  </span>
                  <span style={{ justifySelf: 'center' }}>
                    <Avatar id={t.who} />
                  </span>
                  {on('project') && (
                    <span className="ellipsis" style={{ fontSize: 12, color: 'var(--tx2)' }}>
                      {t.project}
                    </span>
                  )}
                  {on('sprint') && (
                    <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{t.sprint}</span>
                  )}
                  {on('due') && (
                    <span
                      className="mono"
                      style={{ fontSize: 12, color: dueColor(t.dueState) }}
                    >
                      {t.due}
                    </span>
                  )}
                  {on('est') && (
                    <span
                      className="mono"
                      style={{ fontSize: 11.5, color: 'var(--tx2)', textAlign: 'right' }}
                    >
                      {t.est}
                    </span>
                  )}
                </div>
              )
            })}

          {!loading && rows.length === 0 && (
            <Empty
              title="Ничего не найдено"
              text={
                <>
                  По запросу «{query}» задач нет. Измените текст или снимите часть
                  фильтров.
                </>
              }
              action={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setQuery('')
                    setView('Все задачи')
                  }}
                >
                  Сбросить фильтры
                </button>
              }
            />
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: 'var(--surface2)',
            }}
          >
            <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
              Показано {rows.length} из {TOTAL_TASKS}
            </span>
            <div
              className="spacer"
              style={{ display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <button
                type="button"
                className="btn btn--icon btn--sm"
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
                aria-label="Предыдущая страница"
              >
                <Icon name="chevron_left" size={16} />
              </button>
              {[1, 2, 3, '…', 9].map((n, i) => (
                <button
                  key={`${n}-${i}`}
                  type="button"
                  className="btn btn--secondary btn--sm mono"
                  style={{
                    minWidth: 26,
                    height: 26,
                    padding: '0 7px',
                    justifyContent: 'center',
                    background: n === page ? 'var(--ac)' : undefined,
                    borderColor: n === page ? 'var(--ac)' : undefined,
                    color: n === page ? 'var(--ac-fg)' : undefined,
                  }}
                  onClick={() => typeof n === 'number' && setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="btn btn--icon btn--sm"
                onClick={() => setPage(Math.min(9, page + 1))}
                aria-label="Следующая страница"
              >
                <Icon name="chevron_right" size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
