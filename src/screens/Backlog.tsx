import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, PriorityChip, Progress, StatusBadge, TaskKey } from '../components/ui'
import { PEOPLE } from '../data/catalog'
import { findTask } from '../data/tasks'
import type { PersonId } from '../data/types'
import { useApp } from '../store/app'

const CAPACITY = 52

const LOAD: { id: PersonId; sp: number; cap: number }[] = [
  { id: 'AK', sp: 13, cap: 15 },
  { id: 'DS', sp: 18, cap: 16 },
  { id: 'MN', sp: 8, cap: 12 },
  { id: 'IV', sp: 5, cap: 10 },
]

export function Backlog() {
  const nav = useNavigate()
  const {
    sprintKeys,
    backlogKeys,
    statusOf,
    addToSprint,
    removeFromSprint,
    toast,
  } = useApp()

  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overSprint, setOverSprint] = useState(false)

  const points = useMemo(
    () => sprintKeys.reduce((sum, k) => sum + findTask(k).est, 0),
    [sprintKeys],
  )
  const pct = Math.min(100, Math.round((points / CAPACITY) * 100))
  const pctColor = pct > 100 ? 'var(--dang)' : pct > 85 ? 'var(--warn)' : 'var(--ac)'
  const avg = sprintKeys.length ? (points / sprintKeys.length).toFixed(1) : '0'

  const add = (key: string) => {
    addToSprint(key)
    toast('Добавлено в Sprint 25', `${key} · ${findTask(key).est} SP`)
  }

  return (
    <div
      className="split"
      style={{ gridTemplateColumns: 'minmax(0,1fr) 288px', minHeight: '100%', gap: 0 }}
    >
      <div style={{ padding: '14px 16px 30px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div className="page__title">Планирование спринта</div>
          <span style={{ fontSize: 12, color: 'var(--tx2)' }}>
            перетащите задачи из бэклога в спринт
          </span>
        </div>

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
            if (dragKey) add(dragKey)
            setDragKey(null)
            setOverSprint(false)
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '10px 12px',
              background: overSprint ? 'var(--ac-soft)' : 'var(--surface2)',
              borderBottom: '1px solid var(--border)',
              transition: 'background 180ms ease',
            }}
          >
            <Icon name="rotate_right" size={17} color="var(--ac)" />
            <div className="card__title">Sprint 25</div>
            <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>1 – 14 сентября</span>
            <span className="badge mono" style={{ background: 'var(--n-bg)', color: 'var(--tx2)' }}>
              {points} SP / {CAPACITY}
            </span>
            <button
              type="button"
              className="btn btn--primary btn--sm spacer"
              onClick={() =>
                toast('Sprint 25 запущен', `${sprintKeys.length} задач · ${points} SP`)
              }
            >
              Начать спринт
            </button>
          </div>

          {sprintKeys.map((k) => {
            const t = findTask(k)
            return (
              <div
                key={k}
                className="row row--static"
                style={{
                  gridTemplateColumns: '20px 84px minmax(0,1fr) 30px 116px 26px 46px 26px',
                  minWidth: 640,
                }}
              >
                <Icon name="drag_indicator" size={16} color="var(--border2)" />
                <TaskKey>{t.key}</TaskKey>
                <span
                  className="ellipsis"
                  style={{ fontSize: 12.5, cursor: 'pointer' }}
                  onClick={() => nav(`/tasks/${k}`)}
                >
                  {t.title}
                </span>
                <span style={{ justifySelf: 'center' }}>
                  <PriorityChip priority={t.priority} />
                </span>
                <StatusBadge status={statusOf(k)} dot={false} />
                <Avatar id={t.who} />
                <span
                  className="mono"
                  style={{ fontSize: 11.5, color: 'var(--tx2)', textAlign: 'right' }}
                >
                  {t.est} SP
                </span>
                <button
                  type="button"
                  className="btn btn--icon-quiet"
                  style={{ width: 20, height: 20, justifySelf: 'center' }}
                  title="Убрать из спринта"
                  onClick={() => {
                    removeFromSprint(k)
                    toast('Убрано из спринта', k, 'info')
                  }}
                >
                  <Icon name="remove_circle_outline" size={15} />
                </button>
              </div>
            )
          })}

          {overSprint && dragKey && (
            <div className="drop-zone" style={{ margin: '8px 12px', minHeight: 46 }}>
              Добавить в Sprint 25
            </div>
          )}
        </section>

        <section className="card card--clip">
          <div className="card__head">
            <Icon name="inbox" size={17} color="var(--tx3)" />
            <div className="card__title">Бэклог очереди VEKHA</div>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
              {backlogKeys.length} задач
            </span>
            <button type="button" className="btn btn--secondary btn--sm spacer">
              Сортировка: приоритет
            </button>
          </div>
          {backlogKeys.map((k) => {
            const t = findTask(k)
            return (
              <div
                key={k}
                className="row row--static drag-row"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  setDragKey(k)
                }}
                onDragEnd={() => {
                  setDragKey(null)
                  setOverSprint(false)
                }}
                style={{
                  gridTemplateColumns: '20px 84px minmax(0,1fr) 30px 116px 26px 60px 26px',
                  minWidth: 640,
                  opacity: dragKey === k ? 0.45 : 1,
                  background: dragKey === k ? 'var(--ac-soft)' : undefined,
                }}
              >
                <Icon name="drag_indicator" size={16} color="var(--border2)" />
                <TaskKey>{t.key}</TaskKey>
                <span
                  className="ellipsis"
                  style={{ fontSize: 12.5, cursor: 'pointer' }}
                  onClick={() => nav(`/tasks/${k}`)}
                >
                  {t.title}
                </span>
                <span style={{ justifySelf: 'center' }}>
                  <PriorityChip priority={t.priority} />
                </span>
                <StatusBadge status={statusOf(k)} dot={false} />
                <Avatar id={t.who} />
                <button
                  type="button"
                  className="btn btn--secondary btn--sm mono"
                  style={{ height: 22, padding: '0 6px', justifyContent: 'center' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    toast('Оценка', 'Покер-планирование откроется в диалоге', 'info')
                  }}
                >
                  {t.est} SP
                </button>
                <button
                  type="button"
                  className="btn btn--icon-quiet"
                  style={{ width: 20, height: 20, justifySelf: 'center' }}
                  title="В спринт"
                  onClick={(e) => {
                    e.stopPropagation()
                    add(k)
                  }}
                >
                  <Icon name="add_circle_outline" size={16} />
                </button>
              </div>
            )
          })}
          {backlogKeys.length === 0 && (
            <div style={{ padding: '20px 13px', fontSize: 12.5, color: 'var(--tx3)' }}>
              Бэклог пуст — все задачи распределены по спринтам.
            </div>
          )}
        </section>
      </div>

      <aside className="sticky-aside">
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 11 }}>
          Сводка спринта
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: 'var(--tx2)',
              }}
            >
              <span>Ёмкость команды</span>
              <span className="mono">
                {points}/{CAPACITY} SP
              </span>
            </div>
            <Progress
              pct={`${pct}%`}
              color={pctColor}
              variant="thick"
              style={{ marginTop: 5 }}
            />
            <div style={{ fontSize: 11, color: pctColor, marginTop: 5 }}>
              {pct > 85
                ? 'Близко к пределу ёмкости команды'
                : `Есть запас на ${CAPACITY - points} SP`}
            </div>
          </div>

          <div className="vk-sep" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 9 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Задач в спринте</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
                {sprintKeys.length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Средняя оценка</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
                {avg}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Скорость (3 спринта)</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
                44 SP
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Незаоценённых</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--warn)' }}>
                2
              </div>
            </div>
          </div>

          <div className="vk-sep" />

          <div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginBottom: 8 }}>
              Распределение по людям
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LOAD.map((l) => {
                const over = l.sp > l.cap
                const c = over
                  ? 'var(--dang)'
                  : l.sp / l.cap > 0.85
                    ? 'var(--warn)'
                    : 'var(--ac)'
                return (
                  <div
                    key={l.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22px minmax(0,1fr) 78px',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Avatar id={l.id} />
                    <Progress
                      pct={`${Math.min(100, Math.round((l.sp / l.cap) * 100))}%`}
                      color={c}
                      variant="thin"
                      style={{ height: 6, borderRadius: 3 }}
                    />
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: c,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {l.sp} / {l.cap} SP{over ? ' ⚠' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div
            style={{
              padding: '9px 10px',
              background: 'var(--warn-bg)',
              borderRadius: 8,
              display: 'flex',
              gap: 8,
              color: 'var(--warn)',
              fontSize: 11.5,
            }}
          >
            <Icon name="warning" size={16} />
            <span>
              У {PEOPLE.DS.name.split(' ')[0]}а 96% загрузки. Перенесите одну задачу, чтобы
              уложиться в ёмкость.
            </span>
          </div>
        </div>
      </aside>
    </div>
  )
}
