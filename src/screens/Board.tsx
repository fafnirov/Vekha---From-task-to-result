import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, Empty, Icon, PriorityChip, Tag } from '../components/ui'
import { statusStyle } from '../data/catalog'
import { useBoard, useMoveCard, useQueues, useSprints, useWorkflows } from '../api/hooks'
import { useUi } from '../store/ui'
import { useApp } from '../store/app'
import { useSession } from '../store/session'

const FOLD_KEY = 'vekha.board.folded'

export function Board() {
  const nav = useNavigate()
  const ui = useUi()
  const { toast, toastError } = useApp()
  const { can } = useSession()
  const [params, setParams] = useSearchParams()

  const queue = params.get('queue') ?? ''
  const sprint = params.get('sprint') ?? ''
  const assignee = params.get('assignee') ?? ''

  const queues = useQueues()
  const sprints = useSprints()
  const workflows = useWorkflows()
  const board = useBoard({ queue: queue || undefined, sprint: sprint || undefined, assignee: assignee || undefined })
  const move = useMoveCard()

  const [folded, setFolded] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(FOLD_KEY) ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  /* Ключ задачи, только что попавшей в «завершено» — подсветка на 700 мс. */
  const [justDone, setJustDone] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const columns = board.data?.columns ?? []

  /*
   * Пока карточка в воздухе, показываем, какие колонки примут её по
   * воркфлоу. Раньше правила узнавались только методом проб: перенёс —
   * получил отказ. Считается на клиенте из уже загруженных данных.
   */
  const allowedColumns = useMemo(() => {
    if (!dragKey) return null
    const task = board.data?.tasks[dragKey]
    if (!task) return null

    const queueRow = queues.data?.find((q) => q.key === task.queue)
    const wf = workflows.data?.find((w) => w.id === queueRow?.workflowId)
    if (!wf) return null

    const reachable = new Set(
      wf.transitions.filter((t) => t.from === task.status).map((t) => t.to),
    )
    // Колонка, где карточка уже лежит, всегда доступна: это смена порядка.
    reachable.add(task.status)

    return new Set(
      (board.data?.columns ?? [])
        .filter((c) => c.statuses.some((st) => reachable.has(st)))
        .map((c) => c.name),
    )
  }, [dragKey, board.data, queues.data, workflows.data])
  const tasks = board.data?.tasks ?? {}

  /* Аватары в шапке — те, у кого есть карточки на этой доске. */
  const members = useMemo(() => {
    const codes = new Set<string>()
    for (const t of Object.values(tasks)) if (t.who) codes.add(t.who)
    return [...codes].slice(0, 8)
  }, [tasks])

  function toggleFold(name: string) {
    const next = { ...folded, [name]: !folded[name] }
    setFolded(next)
    window.localStorage.setItem(FOLD_KEY, JSON.stringify(next))
  }

  function endDrag() {
    setDragKey(null)
    setOverCol(null)
    setOverIdx(null)
  }

  async function drop(columnName: string) {
    if (!dragKey) return
    const key = dragKey
    const index = overIdx
    endDrag()

    try {
      const result = await move.mutateAsync({
        key,
        column: columnName,
        index,
        queue: queue || undefined,
        sprint: sprint || undefined,
        assignee: assignee || undefined,
      })

      // Закрытие задачи — единственный момент, где интерфейс себя поздравляет.
      const closed = result.task.statusCategory === 'done'
      if (closed) {
        setJustDone(key)
        window.setTimeout(() => setJustDone((k) => (k === key ? null : k)), 700)
      }

      toast('Задача перенесена', `${key} → ${columnName}`, closed ? 'ok' : 'info')
    } catch (err) {
      // Воркфлоу может запретить переход — сообщаем причину и не двигаем карточку.
      toastError(err, 'Перенос не выполнен')
    }
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const boardTitle = queue
    ? `Доска · ${queues.data?.find((q) => q.key === queue)?.name ?? queue}`
    : 'Доска · вся организация'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="board__bar">
        <div className="page__title">{boardTitle}</div>

        <select className="select select--sm" value={queue} onChange={(e) => setParam('queue', e.target.value)}>
          <option value="">Все очереди</option>
          {(queues.data ?? []).map((q) => (
            <option key={q.id} value={q.key}>
              {q.key}
            </option>
          ))}
        </select>

        <select className="select select--sm" value={sprint} onChange={(e) => setParam('sprint', e.target.value)}>
          <option value="">Все спринты</option>
          {(sprints.data ?? []).map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>

        {members.length > 0 && (
          <span className="av-stack" style={{ marginLeft: 4 }}>
            {members.map((m) => (
              <button
                key={m}
                type="button"
                className="av-stack__btn"
                onClick={() => setParam('assignee', assignee === m ? '' : m)}
                title="Показать только задачи участника"
                style={{ opacity: assignee && assignee !== m ? 0.4 : 1 }}
              >
                <Avatar id={m} size="md" />
              </button>
            ))}
          </span>
        )}

        <div className="spacer" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {board.isFetching && <Icon name="progress_activity" size={16} color="var(--tx3)" />}
          <button type="button" className="btn btn--secondary" onClick={() => nav('/filters')}>
            <Icon name="filter_alt" size={16} />
            Фильтры
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => nav('/backlog')}>
            <Icon name="rotate_right" size={16} />
            Бэклог
          </button>
          <button type="button" className="btn btn--primary" onClick={ui.openCreateModal}>
            <Icon name="add" size={16} />
            Задача
          </button>
        </div>
      </div>

      <div className="board__scroll">
        {!board.isLoading && columns.length === 0 && (
          <Empty
            icon="view_kanban"
            title="Колонок нет"
            text="Настройте колонки доски в разделе «Настройки» — каждая колонка собирает свои статусы."
          />
        )}

        <div className={dragKey ? 'board__cols board--dragging' : 'board__cols'}>
          {columns.map((col) => {
            const keys = col.keys
            const isFolded = Boolean(folded[col.name])
            const over = overCol === col.name && Boolean(dragKey)
            const allowed = allowedColumns === null || allowedColumns.has(col.name)
            const exceeded = col.wipLimit > 0 && keys.length > col.wipLimit
            const dot = statusStyle(col.statuses[0] ?? '').dot

            return (
              <div
                key={col.id}
                className={[
                  'bcol',
                  over && 'bcol--over',
                  dragKey && (allowed ? 'bcol--allowed' : 'bcol--forbidden'),
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ width: isFolded ? 52 : 278 }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (overCol !== col.name) {
                    setOverCol(col.name)
                    setOverIdx(null)
                  }
                }}
                onDragLeave={() => {
                  if (overCol === col.name) setOverCol(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  void drop(col.name)
                }}
              >
                <div className="bcol__head" style={{ background: over ? 'var(--ac-soft)' : 'transparent' }}>
                  {!isFolded ? (
                    <>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                        <span
                          style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flex: 'none' }}
                        />
                        <span className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>
                          {col.name}
                        </span>
                        <span
                          className="count-pill"
                          style={{
                            color: exceeded ? 'var(--warn)' : 'var(--tx3)',
                            background: exceeded ? 'var(--warn-bg)' : 'var(--n-bg)',
                          }}
                        >
                          {keys.length}
                          {col.wipLimit > 0 ? ` / ${col.wipLimit}` : ''}
                        </span>
                        {exceeded && (
                          <Icon name="warning" size={15} color="var(--warn)" title="Превышен лимит WIP" />
                        )}
                      </span>
                      <button
                        type="button"
                        className="btn btn--icon-quiet"
                        style={{ width: 20, height: 20 }}
                        title="Свернуть колонку"
                        onClick={() => toggleFold(col.name)}
                      >
                        <Icon name="left_panel_close" size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="bcol__folded"
                      title="Развернуть колонку"
                      onClick={() => toggleFold(col.name)}
                    >
                      <Icon name="left_panel_open" size={16} />
                      <span className="count-pill">{keys.length}</span>
                      <span style={{ writingMode: 'vertical-rl', fontSize: 12, fontWeight: 600 }}>
                        {col.name}
                      </span>
                    </button>
                  )}
                </div>

                {!isFolded && (
                  <div className="bcol__body">
                    {keys.map((k, i) => {
                      const t = tasks[k]
                      if (!t) return null
                      const dragging = dragKey === k
                      const showLine = Boolean(dragKey) && overCol === col.name && overIdx === i && dragKey !== k

                      return (
                        <div key={k} style={{ display: 'contents' }}>
                          {showLine && <div className="drop-line" />}
                          <article
                            className={justDone === k ? 'bcard bcard--just-done' : 'bcard'}
                            draggable={can('task.status')}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move'
                              setDragKey(k)
                            }}
                            onDragEnd={endDrag}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (overCol !== col.name || overIdx !== i) {
                                setOverCol(col.name)
                                setOverIdx(i)
                              }
                            }}
                            onClick={() => nav(`/tasks/${k}`)}
                            style={{
                              boxShadow: dragging ? 'var(--sh3)' : 'var(--sh1)',
                              opacity: dragging ? 0.5 : 1,
                              transform: dragging ? 'scale(1.01) rotate(-0.3deg)' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                                {t.key}
                              </span>
                              <PriorityChip priority={t.priority} small />
                              {t.statusCategory === 'blocked' && (
                                <span className="badge badge--sm badge--block">
                                  <Icon name="block" size={12} />
                                  {t.status.toLowerCase()}
                                </span>
                              )}
                              {t.est > 0 && (
                                <span className="count-pill spacer" style={{ fontSize: 11 }}>
                                  {t.est} SP
                                </span>
                              )}
                            </div>

                            <div className="pretty" style={{ fontSize: 13, lineHeight: 1.4 }}>
                              {t.title}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
                              {t.tags.slice(0, 2).map((tg) => (
                                <Tag key={tg} outline>
                                  {tg}
                                </Tag>
                              ))}
                              <span className="bcard__foot spacer">
                                {t.dueState && (
                                  <span
                                    style={{
                                      color: t.dueState === 'over' ? 'var(--dang)' : 'var(--warn)',
                                    }}
                                    className="mono"
                                  >
                                    {t.due}
                                  </span>
                                )}
                                {t.comments > 0 && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Icon name="chat" size={13} />
                                    {t.comments}
                                  </span>
                                )}
                                <Avatar id={t.who} size="sm" />
                              </span>
                            </div>
                          </article>
                        </div>
                      )
                    })}

                    {over && overIdx === null && <div className="drop-zone">Перенести в {col.name}</div>}

                    {keys.length === 0 && !over && <div className="bcol__empty">Пусто</div>}

                    <button
                      type="button"
                      className="btn btn--dashed"
                      style={{ height: 30, justifyContent: 'center', flex: 'none' }}
                      onClick={ui.openCreateModal}
                    >
                      <Icon name="add" size={15} />
                      Задача
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
