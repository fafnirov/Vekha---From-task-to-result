import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, Empty, Executor, Icon, PriorityChip, Progress, StatusBadge, TaskKey } from '../components/ui'
import { plural, points } from '../data/catalog'
import { api } from '../api/client'
import { useApiMutation, usePlanning, useQueues } from '../api/hooks'
import { useSession } from '../store/session'
import { useUi } from '../store/ui'
import { useApp } from '../store/app'
import type { Task } from '../data/types'

/** Состояние спринта хранится ключом, показывается словом. */
const SPRINT_STATE: Record<string, string> = {
  planned: 'запланирован',
  active: 'идёт',
  closed: 'закрыт',
}

const SPRINT_GRID = '20px 88px minmax(0,1fr) 30px 116px 26px 72px 26px'

export function Backlog() {
  const nav = useNavigate()
  const ui = useUi()
  const { can } = useSession()
  const { toast, toastError } = useApp()
  const [params, setParams] = useSearchParams()

  const queue = params.get('queue') ?? ''
  const sprintName = params.get('sprint') ?? ''

  const queues = useQueues()
  const planning = usePlanning({ queue: queue || undefined, sprint: sprintName || undefined })

  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overSprint, setOverSprint] = useState(false)
  const [creating, setCreating] = useState(false)

  const sprint = planning.data?.sprint ?? null
  const sprintTasks = planning.data?.sprintTasks ?? []
  const backlog = planning.data?.backlog ?? []
  const people = planning.data?.people ?? []
  const summary = planning.data?.summary

  const addToSprint = useApiMutation<{ id: string; key: string }, unknown>(
    ({ id, key }) => api.post(`/api/sprints/${id}/tasks`, { key }),
    ['sprints', 'tasks', 'board'],
  )
  const removeFromSprint = useApiMutation<{ id: string; key: string }, unknown>(
    ({ id, key }) => api.del(`/api/sprints/${id}/tasks/${key}`),
    ['sprints', 'tasks', 'board'],
  )
  const patchSprint = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.patch(`/api/sprints/${id}`, body),
    ['sprints'],
  )
  const closeSprint = useApiMutation<{ id: string; moveTo: string | null }, { moved: number }>(
    ({ id, moveTo }) => api.post(`/api/sprints/${id}/close`, { moveTo }),
    ['sprints', 'tasks', 'board'],
  )
  const dropSprint = useApiMutation<string, { name: string; released: number }>(
    (id) => api.del(`/api/sprints/${id}`),
    ['sprints', 'tasks', 'board'],
  )
  const createSprint = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/sprints', body),
    ['sprints'],
  )

  const planned = summary?.planned ?? 0
  const capacity = summary?.capacity ?? 0
  const pct = capacity ? Math.round((planned / capacity) * 100) : 0
  const pctColor = pct > 100 ? 'var(--dang)' : pct > 85 ? 'var(--warn)' : 'var(--ac)'

  async function add(key: string) {
    if (!sprint) {
      toast('Нет активного спринта', 'Сначала создайте спринт', 'warn')
      return
    }
    try {
      await addToSprint.mutateAsync({ id: sprint.id, key })
      toast(`Добавлено в ${sprint.name}`, key, 'ok')
    } catch (err) {
      toastError(err)
    }
  }

  async function drop(key: string) {
    if (!sprint) {
      toast('Нет активного спринта', 'Сначала создайте спринт', 'warn')
      return
    }
    try {
      await removeFromSprint.mutateAsync({ id: sprint.id, key })
      toast('Убрано из спринта', key, 'info')
    } catch (err) {
      toastError(err)
    }
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const manage = can('sprint.manage')

  return (
    <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', minHeight: '100%', gap: 0 }}>
      <div style={{ padding: '14px 16px 30px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="page__title">Планирование спринта</div>

          <select className="select select--sm" value={queue} onChange={(e) => setParam('queue', e.target.value)}>
            <option value="">Все очереди</option>
            {(queues.data ?? []).map((q) => (
              <option key={q.id} value={q.key}>
                {q.key}
              </option>
            ))}
          </select>

          <select
            className="select select--sm"
            value={sprint?.name ?? ''}
            onChange={(e) => setParam('sprint', e.target.value)}
          >
            <option value="">Активный спринт</option>
            {(planning.data?.sprints ?? []).map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} · {SPRINT_STATE[s.state] ?? s.state}
              </option>
            ))}
          </select>

          {manage && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setCreating(true)}>
              <Icon name="add" size={15} />
              Спринт
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--tx2)' }}>
            перетащите задачи из общего списка в спринт
          </span>
        </div>

        {/* ── Спринт ─────────────────────────────────────────────────── */}
        <section
          className="card"
          style={{
            marginBottom: 12,
            overflowX: 'auto',
            borderColor: overSprint ? 'var(--ac)' : 'var(--border)',
            transition: 'border-color 180ms ease',
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!overSprint) setOverSprint(true)
          }}
          onDragLeave={() => setOverSprint(false)}
          onDrop={(e) => {
            e.preventDefault()
            if (dragKey) void add(dragKey)
            setDragKey(null)
            setOverSprint(false)
          }}
        >
          <div
            className="sprint__head"
            style={{ background: overSprint ? 'var(--ac-soft)' : 'var(--surface2)' }}
          >
            <Icon name="rotate_right" size={17} color="var(--ac)" />
            <div className="card__title">{sprint?.name ?? 'Спринт не выбран'}</div>
            {sprint && <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{sprint.range}</span>}
            <span className="badge mono" style={{ background: 'var(--n-bg)', color: 'var(--tx2)' }}>
              {planned} / {capacity || '—'} б.
            </span>
            {sprint && (
              <span
                className="badge badge--sm"
                style={{
                  background: sprint.state === 'active' ? 'var(--ok-bg)' : 'var(--n-bg)',
                  color: sprint.state === 'active' ? 'var(--ok)' : 'var(--tx2)',
                }}
              >
                {sprint.state === 'active' ? 'идёт' : sprint.state === 'planned' ? 'запланирован' : 'закрыт'}
              </span>
            )}

            {manage && sprint && sprint.state === 'planned' && (
              <button
                type="button"
                className="btn btn--primary btn--sm spacer"
                onClick={() =>
                  void patchSprint
                    .mutateAsync({ id: sprint.id, body: { state: 'active' } })
                    .then(() => toast('Спринт запущен', sprint.name, 'ok'))
                    .catch(toastError)
                }
              >
                Начать спринт
              </button>
            )}
            {manage && sprint && sprint.state === 'active' && (
              <button
                type="button"
                className="btn btn--secondary btn--sm spacer"
                onClick={() =>
                  void closeSprint
                    .mutateAsync({ id: sprint.id, moveTo: null })
                    .then((r) =>
                      toast('Спринт закрыт', `Незакрытых задач убрано из спринта: ${r.moved}`, 'ok'),
                    )
                    .catch(toastError)
                }
              >
                Завершить спринт
              </button>
            )}

            {/*
              Удаление спринта задачи не трогает: они возвращаются в
              бэклог. Об этом сказано прямо в вопросе — иначе кнопка
              рядом с «завершить» читается как «удалить вместе с работой».
            */}
            {manage && sprint && (
              <button
                type="button"
                className={
                  sprint.state === 'closed'
                    ? 'btn btn--icon-quiet spacer'
                    : 'btn btn--icon-quiet'
                }
                title="Удалить спринт"
                aria-label={`Удалить спринт ${sprint.name}`}
                onClick={() => {
                  const n = sprintTasks.length
                  const tail = n > 0 ? ` ${n} задач вернутся в бэклог — они не удалятся.` : ''
                  if (!window.confirm(`Удалить спринт «${sprint.name}»?${tail}`)) return
                  void dropSprint
                    .mutateAsync(sprint.id)
                    .then((r) => {
                      setParam('sprint', '')
                      toast(
                        'Спринт удалён',
                        r.released > 0 ? `Задач вернулось в бэклог: ${r.released}` : sprint.name,
                        'ok',
                      )
                    })
                    .catch(toastError)
                }}
              >
                <Icon name="delete" size={16} />
              </button>
            )}
          </div>

          {sprintTasks.length === 0 && (
            <div className="sprint__empty">
              {overSprint
                ? 'Отпустите, чтобы добавить задачу'
                : !sprint
                  ? 'Выберите спринт наверху — или создайте новый'
                  : 'В спринте пока нет задач'}
            </div>
          )}

          {sprintTasks.map((t) => (
            <PlanRow
              key={t.key}
              task={t}
              grid={SPRINT_GRID}
              onOpen={() => nav(`/tasks/${t.key}`)}
              action={
                manage
                  ? {
                      icon: 'remove_circle_outline',
                      title: 'Убрать из спринта',
                      run: () => void drop(t.key),
                    }
                  : undefined
              }
            />
          ))}
        </section>

        {/* ── Бэклог ─────────────────────────────────────────────────── */}
        <section className="card" style={{ overflowX: 'auto' }}>
          <div className="sprint__head" style={{ background: 'var(--surface2)' }}>
            <Icon name="inbox" size={17} color="var(--tx2)" />
            <div className="card__title">Вне спринтов</div>
            <span className="count-pill">{backlog.length}</span>
            <button type="button" className="btn btn--dashed btn--sm spacer" onClick={ui.openCreateModal}>
              <Icon name="add" size={15} />
              Задача
            </button>
          </div>

          {backlog.length === 0 && !planning.isLoading && (
            <Empty
              icon="inbox"
              title="Вне спринтов ничего нет"
              text="Все незакрытые задачи уже распределены по спринтам."
            />
          )}

          {backlog.map((t) => (
            <PlanRow
              key={t.key}
              task={t}
              grid={SPRINT_GRID}
              draggable={manage}
              onDragStart={() => setDragKey(t.key)}
              onDragEnd={() => setDragKey(null)}
              onOpen={() => nav(`/tasks/${t.key}`)}
              action={
                manage && sprint
                  ? { icon: 'add_circle_outline', title: 'Добавить в спринт', run: () => void add(t.key) }
                  : undefined
              }
            />
          ))}
        </section>
      </div>

      {/* ── Правая колонка: ёмкость и нагрузка ───────────────────────── */}
      <aside className="plan__side">
        <div className="card card--pad">
          <div className="card__title" style={{ marginBottom: 10 }}>
            Ёмкость спринта
          </div>

          <div className="plan__meter">
            <span className="mono" style={{ fontSize: 22, color: pctColor }}>
              {planned}
            </span>
            <span style={{ fontSize: 12, color: 'var(--tx2)' }}>из {capacity || '—'} баллов</span>
          </div>
          <Progress pct={`${Math.min(100, pct)}%`} color={pctColor} style={{ height: 6, borderRadius: 3 }} />

          <div className="plan__facts">
            <div>
              <b className="mono">{summary?.tasks ?? 0}</b>
              <span>задач</span>
            </div>
            <div>
              <b className="mono">{summary?.free ?? 0}</b>
              <span>свободно баллов</span>
            </div>
            <div>
              <b className="mono" style={{ color: summary?.over ? 'var(--dang)' : undefined }}>
                {summary?.over ?? 0}
              </b>
              <span>перебор баллов</span>
            </div>
          </div>

          {manage && sprint && (
            <label className="label" style={{ marginTop: 12 }}>
              <span>Ёмкость команды, баллы</span>
              <input
                className="input"
                type="number"
                min={0}
                defaultValue={sprint.capacity}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (value !== sprint.capacity) {
                    void patchSprint
                      .mutateAsync({ id: sprint.id, body: { capacity: value } })
                      .catch(toastError)
                  }
                }}
              />
            </label>
          )}

          {(summary?.unestimated ?? 0) > 0 && (
            <div className="plan__warn">
              <Icon name="straighten" size={15} color="var(--warn)" />
              {summary?.unestimated} {plural(summary?.unestimated ?? 0, 'задача', 'задачи', 'задач')} без оценки — план неточен
            </div>
          )}
          {(summary?.unassigned ?? 0) > 0 && (
            <div className="plan__warn">
              <Icon name="person_off" size={15} color="var(--warn)" />
              {summary?.unassigned} {plural(summary?.unassigned ?? 0, 'задача', 'задачи', 'задач')} без исполнителя
            </div>
          )}
        </div>

        <div className="card card--pad">
          <div className="card__title" style={{ marginBottom: 10 }}>
            Нагрузка по людям
          </div>

          {people.length === 0 && <div className="plan__none">Нет участников</div>}

          {people.map((p) => (
            <div key={p.id} className="plan__person">
              <Avatar id={p.code} size="md" />
              <span className="ellipsis" style={{ fontSize: 12, flex: 1 }}>
                {p.name}
              </span>
              <span
                className="mono"
                style={{ fontSize: 12, color: p.overloaded ? 'var(--dang)' : 'var(--tx2)' }}
              >
                {p.points}/{p.capacity || '—'}
              </span>
              <Progress
                pct={`${Math.min(100, p.load)}%`}
                color={p.overloaded ? 'var(--dang)' : 'var(--ac)'}
                variant="thin"
                style={{ gridColumn: '1 / -1', marginTop: 4 }}
              />
              {p.overloaded && (
                <span className="plan__over">
                  <Icon name="warning" size={13} color="var(--dang)" />
                  перегрузка
                </span>
              )}
            </div>
          ))}
        </div>
      </aside>

      {creating && (
        <SprintDialog
          queues={(queues.data ?? []).map((q) => ({ key: q.key, name: q.name }))}
          busy={createSprint.isPending}
          onClose={() => setCreating(false)}
          onSave={async (body) => {
            try {
              await createSprint.mutateAsync(body)
              toast('Спринт создан', String(body.name), 'ok')
              setCreating(false)
            } catch (err) {
              toastError(err)
            }
          }}
        />
      )}
    </div>
  )
}

function PlanRow({
  task,
  grid,
  draggable,
  onDragStart,
  onDragEnd,
  onOpen,
  action,
}: {
  task: Task
  grid: string
  draggable?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  onOpen: () => void
  action?: { icon: string; title: string; run: () => void }
}) {
  return (
    <div
      className="row"
      style={{ gridTemplateColumns: grid, minWidth: 660 }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
    >
      <Icon
        name="drag_indicator"
        size={16}
        color={draggable ? 'var(--border2)' : 'transparent'}
      />
      <TaskKey>{task.key}</TaskKey>
      <span className="ellipsis" style={{ fontSize: 13 }}>
        {task.title}
      </span>
      <PriorityChip priority={task.priority} small />
      <StatusBadge status={task.status} category={task.statusCategory} small />
      <Executor who={task.who} team={task.team} teamAbbr={task.teamAbbr} teamBg={task.teamBg} teamFg={task.teamFg} size="md" />
      {/* Нейтральный цвет: раньше оценка красилась цветом просроченного
          срока, и «5 баллов» алым читалось как «с оценкой что-то не так»,
          хотя колонки со сроком в этой таблице нет вовсе. */}
      <span
        className="mono"
        style={{ fontSize: 12, color: 'var(--tx2)', textAlign: 'right', whiteSpace: 'nowrap' }}
      >
        {task.est ? points(task.est) : '—'}
      </span>
      {action ? (
        <button
          type="button"
          className="btn btn--icon-quiet"
          title={action.title}
          onClick={(e) => {
            e.stopPropagation()
            action.run()
          }}
        >
          <Icon name={action.icon} size={16} />
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

function SprintDialog({
  queues,
  busy,
  onClose,
  onSave,
}: {
  queues: { key: string; name: string }[]
  busy: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)

  const [name, setName] = useState('')
  const [queue, setQueue] = useState(queues[0]?.key ?? '')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(inTwoWeeks)
  const [capacity, setCapacity] = useState('40')

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 520, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Новый спринт"
      >
        <div className="modal__head">
          <Icon name="rotate_right" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Новый спринт</div>
          <button type="button" className="btn btn--icon-quiet spacer" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="modal__body">
          <div className="grid-2">
            <label className="label">
              <span>Название</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Спринт 25"
                autoFocus
              />
            </label>
            <label className="label">
              <span>Очередь</span>
              <select className="select" value={queue} onChange={(e) => setQueue(e.target.value)}>
                {queues.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.key} · {q.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="label">
            <span>Цель спринта</span>
            <input
              className="input"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Что команда хочет получить к концу"
            />
          </label>

          <div className="grid-3">
            <label className="label">
              <span>Начало</span>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="label">
              <span>Окончание</span>
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="label">
              <span>Ёмкость, баллы</span>
              <input
                className="input"
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--secondary btn--lg spacer" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={busy}
            onClick={() =>
              onSave({ name, queue, goal, startDate, endDate, capacity: Number(capacity), state: 'planned' })
            }
          >
            Создать спринт
          </button>
        </div>
      </div>
    </div>
  )
}
