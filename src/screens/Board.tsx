import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, PriorityChip, Tag } from '../components/ui'
import { findTask } from '../data/tasks'
import type { PersonId } from '../data/types'
import { useApp, type BoardColumnId } from '../store/app'
import { useUi } from '../store/ui'

interface ColumnMeta {
  id: BoardColumnId
  name: string
  limit: number | null
  dot: string
}

const COLUMNS: ColumnMeta[] = [
  { id: 'Backlog', name: 'Backlog', limit: null, dot: 'var(--tx3)' },
  { id: 'To Do', name: 'To Do', limit: null, dot: 'var(--info)' },
  { id: 'In Progress', name: 'In Progress', limit: 4, dot: 'var(--ac)' },
  { id: 'Review', name: 'Review', limit: 3, dot: 'var(--warn)' },
  { id: 'Done', name: 'Done', limit: null, dot: 'var(--ok)' },
]

const BOARD_MEMBERS: PersonId[] = ['AK', 'DS', 'MN', 'IV', 'EL']

export function Board() {
  const nav = useNavigate()
  const ui = useUi()
  const { board, boardFold, toggleFold, moveCard, statusOf, toast } = useApp()

  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<BoardColumnId | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const endDrag = () => {
    setDragKey(null)
    setOverCol(null)
    setOverIdx(null)
  }

  const drop = (col: ColumnMeta) => {
    if (!dragKey) return
    moveCard(dragKey, col.id, overIdx)
    toast('Задача перенесена', `${dragKey} → ${col.name}`, col.id === 'Done' ? 'ok' : 'info')
    endDrag()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--workspace)',
          flex: 'none',
        }}
      >
        <div className="page__title">Доска · Продуктовая команда</div>
        <span className="badge" style={{ background: 'var(--ac-soft)', color: 'var(--ac-tx)' }}>
          Sprint 24
        </span>
        <span className="av-stack" style={{ marginLeft: 8 }}>
          {BOARD_MEMBERS.map((m) => (
            <Avatar key={m} id={m} size="md" />
          ))}
        </span>
        <div className="spacer" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '12px 16px 16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            height: '100%',
            alignItems: 'stretch',
            minWidth: 'max-content',
          }}
        >
          {COLUMNS.map((col) => {
            const keys = board[col.id]
            const folded = Boolean(boardFold[col.id])
            const over = overCol === col.id && Boolean(dragKey)
            const exceeded = col.limit !== null && keys.length > col.limit

            return (
              <div
                key={col.id}
                className="bcol"
                style={{
                  width: folded ? 52 : 278,
                  background: over ? 'var(--ac-soft)' : 'var(--surface2)',
                  borderColor: over ? 'var(--ac)' : 'var(--border)',
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (overCol !== col.id) {
                    setOverCol(col.id)
                    setOverIdx(null)
                  }
                }}
                onDragLeave={() => {
                  if (overCol === col.id) setOverCol(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  drop(col)
                }}
              >
                <div
                  className="bcol__head"
                  style={{ background: over ? 'var(--ac-soft)' : 'transparent' }}
                >
                  {!folded ? (
                    <>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <Icon
                          name="drag_indicator"
                          size={16}
                          color="var(--border2)"
                          title="Перетащите, чтобы изменить порядок колонок"
                        />
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: col.dot,
                            flex: 'none',
                          }}
                        />
                        <span className="ellipsis" style={{ fontSize: 12.5, fontWeight: 600 }}>
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
                          {col.limit !== null ? ` / ${col.limit}` : ''}
                        </span>
                        {exceeded && (
                          <Icon
                            name="warning"
                            size={15}
                            color="var(--warn)"
                            title="Превышен лимит WIP"
                          />
                        )}
                      </span>
                      <button
                        type="button"
                        className="btn btn--icon-quiet"
                        style={{ width: 20, height: 20 }}
                        title="Свернуть колонку"
                        onClick={() => toggleFold(col.id)}
                      >
                        <Icon name="left_panel_close" size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="bcol__folded"
                      title="Развернуть колонку"
                      onClick={() => toggleFold(col.id)}
                    >
                      <Icon name="left_panel_open" size={16} />
                      <span className="count-pill">{keys.length}</span>
                      <span
                        style={{
                          writingMode: 'vertical-rl',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {col.name}
                      </span>
                    </button>
                  )}
                </div>

                {!folded && (
                  <div className="bcol__body">
                    {keys.map((k, i) => {
                      const t = findTask(k)
                      const status = statusOf(k)
                      const dragging = dragKey === k
                      const showLine =
                        Boolean(dragKey) &&
                        overCol === col.id &&
                        overIdx === i &&
                        dragKey !== k
                      return (
                        <div key={k} style={{ display: 'contents' }}>
                          {showLine && <div className="drop-line" />}
                          <article
                            className="bcard"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move'
                              setDragKey(k)
                            }}
                            onDragEnd={endDrag}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (overCol !== col.id || overIdx !== i) {
                                setOverCol(col.id)
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
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginBottom: 6,
                              }}
                            >
                              <span
                                className="mono"
                                style={{ fontSize: 11, color: 'var(--tx3)' }}
                              >
                                {t.key}
                              </span>
                              <PriorityChip priority={t.priority} small />
                              {status === 'Blocked' && (
                                <span
                                  className="badge badge--sm"
                                  style={{
                                    background: 'var(--dang-bg)',
                                    color: 'var(--dang)',
                                    height: 17,
                                    fontSize: 10,
                                  }}
                                >
                                  <Icon name="block" size={12} />
                                  blocked
                                </span>
                              )}
                              <span
                                className="count-pill spacer"
                                style={{ fontSize: 10.5 }}
                              >
                                {t.est} SP
                              </span>
                            </div>
                            <div className="pretty" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                              {t.title}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                marginTop: 8,
                              }}
                            >
                              {t.tags.slice(0, 2).map((tg) => (
                                <Tag key={tg} outline>
                                  {tg}
                                </Tag>
                              ))}
                              <span
                                className="spacer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  color: 'var(--tx3)',
                                  fontSize: 10.5,
                                }}
                              >
                                <span
                                  style={{ display: 'flex', alignItems: 'center', gap: 2 }}
                                >
                                  <Icon name="chat" size={13} />
                                  {2 + (k.length % 4)}
                                </span>
                                <Avatar id={t.who} size="sm" />
                              </span>
                            </div>
                          </article>
                        </div>
                      )
                    })}

                    {over && overIdx === null && (
                      <div className="drop-zone">Перенести в {col.name}</div>
                    )}

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
