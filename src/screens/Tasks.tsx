import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { PRIORITY_KEY, PRIORITY_NAMES, dueColor } from '../data/catalog'
import {
  useBulkUpdate,
  useFilters,
  useQueues,
  useSprints,
  useTags,
  useTasks,
  useWorkflows,
  type TaskQuery,
} from '../api/hooks'
import { useSession } from '../store/session'
import { useUi } from '../store/ui'
import { useApp } from '../store/app'

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

const OPTIONAL_COLS = {
  project: 'Проект',
  sprint: 'Спринт',
  due: 'Дедлайн',
  est: 'SP',
} as const

type OptionalCol = keyof typeof OPTIONAL_COLS

const SKELETON_WIDTHS = ['72%', '54%', '63%', '48%', '80%', '58%', '66%', '44%']

/** Параметры, которые попадают в адресную строку и в чипы фильтров. */
const FILTER_PARAMS = ['queue', 'status', 'assignee', 'project', 'sprint', 'tag', 'q'] as const

const CHIP_LABEL: Record<string, string> = {
  queue: 'Очередь:',
  status: 'Статус:',
  assignee: 'Исполнитель:',
  project: 'Проект:',
  sprint: 'Спринт:',
  tag: 'Тег:',
  q: 'Запрос:',
}

const COLS_KEY = 'vekha.tasks.columns'
const WIDTH_KEY = 'vekha.tasks.titleWidth'

export function Tasks() {
  const nav = useNavigate()
  const ui = useUi()
  const { me, can } = useSession()
  const { toast, toastError } = useApp()
  const [params, setParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('key')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [sel, setSel] = useState<string[]>([])
  const [colsOpen, setColsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [bulkOpen, setBulkOpen] = useState<string | null>(null)

  /* Набор колонок и ширина заголовка — личная настройка, живёт в браузере. */
  const [cols, setCols] = useState<Record<OptionalCol, boolean>>(() => {
    try {
      const saved = window.localStorage.getItem(COLS_KEY)
      if (saved) return JSON.parse(saved) as Record<OptionalCol, boolean>
    } catch {
      /* повреждённое значение просто игнорируем */
    }
    return { project: true, sprint: true, due: true, est: true }
  })
  const [titleW, setTitleW] = useState(() => Number(window.localStorage.getItem(WIDTH_KEY)) || 420)

  useEffect(() => {
    window.localStorage.setItem(COLS_KEY, JSON.stringify(cols))
  }, [cols])
  useEffect(() => {
    window.localStorage.setItem(WIDTH_KEY, String(titleW))
  }, [titleW])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 220)
    return () => window.clearTimeout(timer)
  }, [search])

  const queues = useQueues()
  const sprints = useSprints()
  const tags = useTags()
  const workflows = useWorkflows()
  const filters = useFilters()
  const bulk = useBulkUpdate()

  const statuses = useMemo(() => {
    const names = new Set<string>()
    for (const w of workflows.data ?? []) for (const s of w.statuses) names.add(s.name)
    return [...names]
  }, [workflows.data])

  const activeSprint = (sprints.data ?? []).find((s) => s.state === 'active')

  /* Встроенные представления плюс избранные фильтры пользователя. */
  const views = useMemo(() => {
    const base: { id: string; label: string; query: TaskQuery }[] = [
      { id: 'all', label: 'Все задачи', query: {} },
      { id: 'mine', label: 'Мои', query: { mine: true, category: 'todo,inprogress,blocked' } },
      { id: 'urgent', label: 'Срочно', query: { priority: 'critical', category: 'todo,inprogress,blocked' } },
      { id: 'overdue', label: 'Просроченные', query: { overdue: true } },
      ...(activeSprint
        ? [{ id: 'sprint', label: activeSprint.name, query: { sprint: activeSprint.name } }]
        : []),
      { id: 'watching', label: 'Наблюдаю', query: { watching: true } },
    ]
    const favorites = (filters.data?.favorites ?? []).map((f) => ({
      id: `f:${f.id}`,
      label: f.label,
      query: { q: f.query } as TaskQuery,
    }))
    return [...base, ...favorites]
  }, [activeSprint, filters.data])

  const [viewId, setViewId] = useState('all')
  const view = views.find((v) => v.id === viewId) ?? views[0]

  /* Фильтры из адресной строки складываются с фильтрами представления. */
  const urlFilters = useMemo(() => {
    const out: Record<string, string> = {}
    for (const key of FILTER_PARAMS) {
      const value = params.get(key)
      if (value) out[key] = value
    }
    return out
  }, [params])

  const query: TaskQuery = useMemo(
    () => ({
      ...view.query,
      ...urlFilters,
      search: debounced || undefined,
      page,
      perPage: 25,
      sort: sortKey,
      dir: sortDir,
    }),
    [view, urlFilters, debounced, page, sortKey, sortDir],
  )

  const tasks = useTasks(query)
  const rows = tasks.data?.items ?? []
  const total = tasks.data?.total ?? 0
  const pages = tasks.data?.pages ?? 1

  useEffect(() => {
    setPage(1)
    setSel([])
  }, [viewId, debounced, urlFilters])

  const on = (k: OptionalCol) => cols[k]

  const gridCols = useMemo(() => {
    const w = ['32px', '96px', `minmax(0,${titleW}px)`, '124px', '32px', '32px']
    if (cols.project) w.push('138px')
    if (cols.sprint) w.push('90px')
    if (cols.due) w.push('78px')
    if (cols.est) w.push('46px')
    return w.join(' ')
  }, [titleW, cols])

  const gridMin = useMemo(() => {
    const base =
      348 +
      titleW +
      (cols.project ? 138 : 0) +
      (cols.sprint ? 90 : 0) +
      (cols.due ? 78 : 0) +
      (cols.est ? 46 : 0)
    return `${base + 80}px`
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

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX
    const w0 = titleW
    const move = (ev: MouseEvent) => setTitleW(Math.max(220, Math.min(760, w0 + ev.clientX - x0)))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function sortBy(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  async function applyBulk(patch: Record<string, unknown>, label: string) {
    setBulkOpen(null)
    try {
      const result = await bulk.mutateAsync({ keys: sel, ...patch })
      if (result.failed.length) {
        toast(
          `${label}: применено к ${result.applied}`,
          `Не удалось: ${result.failed.map((f) => `${f.key} — ${f.reason}`).join('; ')}`,
          'warn',
        )
      } else {
        toast(label, `Изменено задач: ${result.applied}`, 'ok')
      }
      setSel([])
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="tasks__bar">
        <div className="tasks__views">
          <div className="page__title" style={{ marginRight: 10 }}>
            Задачи
          </div>
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              className={v.id === viewId ? 'tab tab--on' : 'tab'}
              style={{ height: 28, padding: '0 10px' }}
              onClick={() => setViewId(v.id)}
            >
              {v.label}
              <span className="tab__underline" style={{ bottom: -1 }} />
            </button>
          ))}
          <button
            type="button"
            className="btn btn--dashed btn--sm"
            style={{ marginLeft: 6 }}
            onClick={() => nav('/filters')}
          >
            <Icon name="bookmark_add" size={15} />
            Сохранить
          </button>

          <div className="spacer" style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn--icon" title="Вид: доска" onClick={() => nav('/board')}>
              <Icon name="view_kanban" size={17} />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={colsOpen ? 'btn btn--secondary btn--on' : 'btn btn--secondary'}
                onClick={() => setColsOpen(!colsOpen)}
              >
                <Icon name="view_column" size={16} />
                Колонки
              </button>
              {colsOpen && (
                <>
                  <div className="scrim scrim--bare" onClick={() => setColsOpen(false)} />
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
                    <div className="menu__note">
                      Набор колонок и ширина сохраняются в этом браузере
                    </div>
                  </div>
                </>
              )}
            </div>
            <button type="button" className="btn btn--primary" onClick={ui.openCreateModal}>
              <Icon name="add" size={16} />
              Задача
            </button>
          </div>
        </div>

        <div className="tasks__filters">
          <div className="field" style={{ width: 238 }}>
            <Icon name="search" size={16} color="var(--tx3)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Быстрый поиск"
              aria-label="Быстрый поиск по задачам"
            />
          </div>

          {Object.entries(urlFilters).map(([key, value]) => (
            <div key={key} className="chip">
              <span className="chip__k">{CHIP_LABEL[key] ?? key}</span>
              <span className="chip__v">{value}</span>
              <button
                type="button"
                className="chip__x"
                aria-label={`Убрать фильтр ${key}`}
                onClick={() => setFilter(key, null)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}

          <FilterPicker
            queues={(queues.data ?? []).map((q) => q.key)}
            statuses={statuses}
            sprints={(sprints.data ?? []).map((s) => s.name)}
            tags={(tags.data ?? []).map((t) => t.name)}
            onPick={setFilter}
          />

          <div className="tasks__count spacer">
            <span className="mono">{total}</span> задач
            {tasks.isFetching && <Icon name="progress_activity" size={14} color="var(--tx3)" />}
          </div>
        </div>

        {sel.length > 0 && (
          <div className="tasks__bulk">
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ac-tx)' }}>
              Выбрано: {sel.length}
            </span>
            <div style={{ width: 1, height: 16, background: 'var(--ac-soft2)' }} />

            <BulkMenu
              open={bulkOpen === 'status'}
              onToggle={() => setBulkOpen(bulkOpen === 'status' ? null : 'status')}
              icon="sync_alt"
              label="Статус"
              options={statuses.map((s) => ({ value: s, label: s }))}
              onPick={(value) => void applyBulk({ status: value }, `Статус → ${value}`)}
            />
            <BulkMenu
              open={bulkOpen === 'assignee'}
              onToggle={() => setBulkOpen(bulkOpen === 'assignee' ? null : 'assignee')}
              icon="person_add"
              label="Назначить"
              options={[
                { value: '', label: 'Снять исполнителя' },
                ...(me ? [{ value: me.code, label: `${me.name} (я)` }] : []),
              ]}
              onPick={(value) => void applyBulk({ assignee: value || null }, 'Исполнитель изменён')}
            />
            <BulkMenu
              open={bulkOpen === 'priority'}
              onToggle={() => setBulkOpen(bulkOpen === 'priority' ? null : 'priority')}
              icon="keyboard_arrow_up"
              label="Приоритет"
              options={PRIORITY_NAMES.map((p) => ({ value: PRIORITY_KEY[p], label: p }))}
              onPick={(value) => void applyBulk({ priority: value }, 'Приоритет изменён')}
            />
            {can('sprint.manage') && (
              <BulkMenu
                open={bulkOpen === 'sprint'}
                onToggle={() => setBulkOpen(bulkOpen === 'sprint' ? null : 'sprint')}
                icon="rotate_right"
                label="В спринт"
                options={[
                  { value: '', label: 'Вернуть в бэклог' },
                  ...(sprints.data ?? [])
                    .filter((s) => s.state !== 'closed')
                    .map((s) => ({ value: s.name, label: s.name })),
                ]}
                onPick={(value) => void applyBulk({ sprint: value || null }, 'Спринт изменён')}
              />
            )}

            <button type="button" className="btn btn--quiet spacer" onClick={() => setSel([])}>
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
              label="Выбрать все задачи на странице"
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
                    {sortKey === c.k && sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
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

          {tasks.isLoading &&
            SKELETON_WIDTHS.map((w, i) => (
              <div key={i} className="row-skeleton">
                <div className="row-skeleton__box" />
                <div className="skel" style={{ width: 64 }} />
                <div className="skel" style={{ width: w }} />
                <div className="row-skeleton__pill" />
                <div className="row-skeleton__line" />
              </div>
            ))}

          {!tasks.isLoading &&
            rows.map((t) => {
              const selected = sel.includes(t.key)
              return (
                <div
                  key={t.key}
                  className={selected ? 'row row--on' : 'row'}
                  style={{ gridTemplateColumns: gridCols, minWidth: gridMin, gap: 8, padding: '0 12px' }}
                  onClick={() => nav(`/tasks/${t.key}`)}
                >
                  <Checkbox
                    small
                    on={selected}
                    label={`Выбрать ${t.key}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSel(selected ? sel.filter((k) => k !== t.key) : [...sel, t.key])
                    }}
                  />
                  <TaskKey>{t.key}</TaskKey>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <Icon
                      name={t.typeIcon}
                      size={15}
                      color={t.typeColor}
                      title={t.type ?? undefined}
                    />
                    <span className="ellipsis" style={{ fontSize: 13 }}>
                      {t.title}
                    </span>
                    {t.tags.slice(0, 2).map((tg) => (
                      <Tag key={tg}>{tg}</Tag>
                    ))}
                    {t.comments > 0 && (
                      <span className="row__meta" title={`${t.comments} комментариев`}>
                        <Icon name="chat" size={13} />
                        {t.comments}
                      </span>
                    )}
                    {t.subtasks > 0 && (
                      <span className="row__meta" title={`${t.subtasks} подзадач`}>
                        <Icon name="account_tree" size={13} />
                        {t.subtasks}
                      </span>
                    )}
                  </span>
                  <StatusBadge status={t.status} category={t.statusCategory} />
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
                  {on('sprint') && <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{t.sprint}</span>}
                  {on('due') && (
                    <span className="mono" style={{ fontSize: 12, color: dueColor(t.dueState) }}>
                      {t.due}
                    </span>
                  )}
                  {on('est') && (
                    <span className="mono" style={{ fontSize: 12, color: 'var(--tx2)', textAlign: 'right' }}>
                      {t.est || '—'}
                    </span>
                  )}
                </div>
              )
            })}

          {!tasks.isLoading && rows.length === 0 && (
            <Empty
              title="Ничего не найдено"
              text="Под выбранные условия не подошла ни одна задача. Измените поиск или снимите часть фильтров."
              action={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setSearch('')
                    setViewId('all')
                    setParams(new URLSearchParams(), { replace: true })
                  }}
                >
                  Сбросить фильтры
                </button>
              }
            />
          )}

          <div className="tasks__foot">
            <span style={{ fontSize: 12, color: 'var(--tx3)' }}>
              Показано {rows.length} из {total}
            </span>
            <div className="spacer" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button
                type="button"
                className="btn btn--icon btn--sm"
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
                aria-label="Предыдущая страница"
              >
                <Icon name="chevron_left" size={16} />
              </button>
              {pageNumbers(page, pages).map((n, i) =>
                n === '…' ? (
                  <span key={`gap-${i}`} className="mono" style={{ color: 'var(--tx3)', padding: '0 4px' }}>
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className="btn btn--secondary btn--sm mono tasks__page"
                    style={
                      n === page
                        ? { background: 'var(--ac)', borderColor: 'var(--ac)', color: 'var(--ac-fg)' }
                        : undefined
                    }
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                className="btn btn--icon btn--sm"
                disabled={page >= pages}
                onClick={() => setPage(Math.min(pages, page + 1))}
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

/** Номера страниц с многоточием: 1 … 7 8 9 … 21. */
function pageNumbers(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const from = Math.max(2, page - 1)
  const to = Math.min(pages - 1, page + 1)
  if (from > 2) out.push('…')
  for (let n = from; n <= to; n += 1) out.push(n)
  if (to < pages - 1) out.push('…')
  out.push(pages)
  return out
}

function FilterPicker({
  queues,
  statuses,
  sprints,
  tags,
  onPick,
}: {
  queues: string[]
  statuses: string[]
  sprints: string[]
  tags: string[]
  onPick: (key: string, value: string) => void
}) {
  const [open, setOpen] = useState(false)

  const groups = [
    { key: 'queue', label: 'Очередь', values: queues },
    { key: 'status', label: 'Статус', values: statuses },
    { key: 'sprint', label: 'Спринт', values: sprints },
    { key: 'tag', label: 'Тег', values: tags.slice(0, 12) },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="btn btn--dashed" onClick={() => setOpen(!open)}>
        <Icon name="add" size={15} />
        Фильтр
      </button>
      {open && (
        <>
          <div className="scrim scrim--bare" onClick={() => setOpen(false)} />
          <div className="menu menu--wide" style={{ top: 32, left: 0 }}>
            {groups.map((g) => (
              <div key={g.key} className="menu__group">
                <div className="vk-eyebrow">{g.label}</div>
                <div className="menu__chips">
                  {g.values.length === 0 && <span className="menu__note">нет значений</span>}
                  {g.values.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="tag tag--outline"
                      onClick={() => {
                        onPick(g.key, v)
                        setOpen(false)
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BulkMenu({
  open,
  onToggle,
  icon,
  label,
  options,
  onPick,
}: {
  open: boolean
  onToggle: () => void
  icon: string
  label: string
  options: { value: string; label: string }[]
  onPick: (value: string) => void
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="btn btn--secondary btn--sm" onClick={onToggle}>
        <Icon name={icon} size={15} />
        {label}
      </button>
      {open && (
        <>
          <div className="scrim scrim--bare" onClick={onToggle} />
          <div className="menu" style={{ top: 30, left: 0, width: 210 }}>
            {options.map((o) => (
              <button
                key={o.value || 'none'}
                type="button"
                className="menu__item"
                onClick={() => onPick(o.value)}
              >
                <span style={{ flex: 1, fontSize: 13 }}>{o.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
