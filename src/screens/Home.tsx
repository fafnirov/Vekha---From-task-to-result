import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Icon,
  PriorityChip,
  Progress,
  Segmented,
  StatusBadge,
  TaskKey,
} from '../components/ui'
import { ACTIVITY, ATTENTION, ATTENTION_REASONS, MENTIONS } from '../data/feed'
import { CURRENT_USER, PEOPLE, dueColor } from '../data/catalog'
import { PROJECTS } from '../data/projects'
import { TASKS, findTask } from '../data/tasks'
import { useApp } from '../store/app'
import { useUi } from '../store/ui'

const ATTENTION_FILTERS = [
  { value: 'all', label: 'Всё' },
  { value: 'late', label: 'Просрочено' },
  { value: 'mine', label: 'Ждёт меня' },
] as const

const MY_TABS = [
  { value: 'progress', label: 'В работе' },
  { value: 'review', label: 'На ревью' },
  { value: 'all', label: 'Все мои' },
] as const

const KPIS = [
  {
    label: 'Мои задачи',
    value: '6',
    delta: '+2',
    icon: 'assignment_ind',
    bg: 'var(--ac-soft)',
    fg: 'var(--ac)',
    deltaFg: 'var(--tx3)',
    to: '/tasks',
  },
  {
    label: 'Требует внимания',
    value: '2',
    delta: 'сегодня',
    icon: 'notification_important',
    bg: 'var(--warn-bg)',
    fg: 'var(--warn)',
    deltaFg: 'var(--warn)',
    to: '/tasks',
  },
  {
    label: 'Просрочено',
    value: '1',
    delta: '−1',
    icon: 'schedule',
    bg: 'var(--dang-bg)',
    fg: 'var(--dang)',
    deltaFg: 'var(--ok)',
    to: '/reports',
  },
  {
    label: 'На ревью',
    value: '3',
    delta: '+1',
    icon: 'rate_review',
    bg: 'var(--vio-bg)',
    fg: 'var(--vio)',
    deltaFg: 'var(--tx3)',
    to: '/board',
  },
  {
    label: 'Закрыто за неделю',
    value: '12',
    delta: '+21%',
    icon: 'task_alt',
    bg: 'var(--ok-bg)',
    fg: 'var(--ok)',
    deltaFg: 'var(--ok)',
    to: '/reports',
  },
]

const SPRINT_BARS = [
  { c: 'var(--ok)', label: 'Done', n: 12 },
  { c: 'var(--ac)', label: 'In Progress', n: 8 },
  { c: 'var(--warn)', label: 'Review', n: 5 },
  { c: 'var(--border2)', label: 'To Do', n: 9 },
]

export function Home() {
  const nav = useNavigate()
  const { statusOf } = useApp()
  const ui = useUi()
  const [attFilter, setAttFilter] =
    useState<(typeof ATTENTION_FILTERS)[number]['value']>('all')
  const [myTab, setMyTab] = useState<(typeof MY_TABS)[number]['value']>('progress')

  const attention = useMemo(
    () =>
      ATTENTION.filter((a) => {
        if (attFilter === 'late')
          return a.kind === 'blocked' || a.kind === 'today' || a.kind === 'overdue'
        if (attFilter === 'mine') return a.kind === 'review' || a.kind === 'mention'
        return true
      }),
    [attFilter],
  )

  const myTasks = useMemo(() => {
    const mine = TASKS.filter((t) => t.who === CURRENT_USER)
    if (myTab === 'progress')
      return mine.filter((t) => statusOf(t.key) === 'In Progress')
    if (myTab === 'review') return mine.filter((t) => statusOf(t.key) === 'Review')
    return mine
  }, [myTab, statusOf])

  return (
    <div style={{ padding: '16px 20px 30px', maxWidth: 1560 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em' }}>
            Доброе утро, Анна
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 2 }}>
            6 задач в работе · 2 требуют внимания · четверг, 21 августа
          </div>
        </div>
        <div className="spacer" style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => nav('/board')}
          >
            <Icon name="view_kanban" size={16} />
            Доска команды
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => nav('/backlog')}
          >
            <Icon name="rotate_right" size={16} />
            Спринт
          </button>
          <button type="button" className="btn btn--primary" onClick={ui.openCreateModal}>
            <Icon name="add" size={16} />
            Задача
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5,minmax(0,1fr))',
          gap: 8,
          marginBottom: 12,
        }}
      >
        {KPIS.map((k) => (
          <button
            key={k.label}
            type="button"
            className="card kpi"
            onClick={() => nav(k.to)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 11px',
              borderRadius: 9,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: k.bg,
                color: k.fg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              <Icon name={k.icon} size={16} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span
                className="ellipsis"
                style={{ display: 'block', fontSize: 11.5, color: 'var(--tx2)' }}
              >
                {k.label}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span
                  className="mono"
                  style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}
                >
                  {k.value}
                </span>
                <span style={{ fontSize: 11, color: k.deltaFg, whiteSpace: 'nowrap' }}>
                  {k.delta}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <div
        className="split"
        style={{ gridTemplateColumns: 'minmax(0,1.62fr) minmax(0,1fr)' }}
      >
        <div className="stack">
          <section className="card card--clip">
            <div className="card__head">
              <div className="card__title">Требует внимания</div>
              <span className="count-pill">{attention.length}</span>
              <Segmented
                options={ATTENTION_FILTERS}
                value={attFilter}
                onChange={setAttFilter}
                style={{ marginLeft: 'auto' }}
              />
            </div>
            {attention.map((a) => {
              const t = findTask(a.key)
              const r = ATTENTION_REASONS[a.kind]
              return (
                <div
                  key={a.key}
                  className="row"
                  onClick={() => nav(`/tasks/${a.key}`)}
                  style={{
                    gridTemplateColumns: '3px 96px minmax(0,1fr) auto auto 24px',
                    gap: 10,
                    padding: '0 13px 0 0',
                    height: 38,
                  }}
                >
                  <span style={{ width: 3, height: 38, background: r.bar }} />
                  <span style={{ marginLeft: 10 }}>
                    <TaskKey>{t.key}</TaskKey>
                  </span>
                  <span className="ellipsis" style={{ fontSize: 12.5 }}>
                    {t.title}
                  </span>
                  <span className="badge" style={{ background: r.bg, color: r.fg, height: 20 }}>
                    <Icon name={r.icon} size={13} />
                    {r.reason}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 11.5, color: 'var(--tx3)', whiteSpace: 'nowrap' }}
                  >
                    {a.meta}
                  </span>
                  <Avatar id={t.who} />
                </div>
              )
            })}
          </section>

          <section className="card card--clip">
            <div className="card__head">
              <div className="card__title">Мои задачи</div>
              <Segmented options={MY_TABS} value={myTab} onChange={setMyTab} />
              <button
                type="button"
                className="btn btn--link spacer"
                onClick={() => nav('/tasks')}
              >
                Показать все задачи
                <Icon name="arrow_forward" size={15} />
              </button>
            </div>
            {myTasks.length === 0 && (
              <div style={{ padding: '18px 13px', fontSize: 12.5, color: 'var(--tx3)' }}>
                В этой группе задач нет.
              </div>
            )}
            {myTasks.map((t) => (
              <div
                key={t.key}
                className="row"
                onClick={() => nav(`/tasks/${t.key}`)}
                style={{ gridTemplateColumns: '96px minmax(0,1fr) 19px 118px 62px' }}
              >
                <TaskKey>{t.key}</TaskKey>
                <span className="ellipsis" style={{ fontSize: 12.5 }}>
                  {t.title}
                </span>
                <PriorityChip priority={t.priority} />
                <StatusBadge status={statusOf(t.key)} />
                <span
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    color: dueColor(t.dueState),
                    textAlign: 'right',
                  }}
                >
                  {t.due}
                </span>
              </div>
            ))}
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <div className="card__title">Активные проекты</div>
              <button
                type="button"
                className="btn btn--link spacer"
                onClick={() => nav('/projects')}
              >
                Все проекты
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                gap: 10,
              }}
            >
              {PROJECTS.slice(0, 3).map((p) => (
                <div
                  key={p.name}
                  className="card card--hover"
                  style={{ padding: '11px 12px' }}
                  onClick={() => nav(`/projects/${encodeURIComponent(p.name)}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: p.bg,
                        color: p.fg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10.5,
                        fontWeight: 600,
                        flex: 'none',
                      }}
                    >
                      {p.abbr}
                    </div>
                    <div
                      className="ellipsis"
                      style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}
                    >
                      {p.name}
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--tx2)' }}>
                      {p.pct}
                    </span>
                  </div>
                  <Progress
                    pct={p.pct}
                    color={p.fg}
                    variant="thin"
                    style={{ marginTop: 9 }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 9,
                      fontSize: 11,
                      color: 'var(--tx2)',
                    }}
                  >
                    <Icon name="flag" size={14} color="var(--tx3)" />
                    <span className="ellipsis">{p.milestone}</span>
                    <span
                      className="mono spacer"
                      style={{ color: p.atRisk ? 'var(--dang)' : 'var(--tx2)' }}
                    >
                      {p.due}
                    </span>
                  </div>
                  {p.atRisk && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        marginTop: 8,
                        padding: '5px 7px',
                        background: 'var(--dang-bg)',
                        borderRadius: 6,
                        fontSize: 11,
                        color: 'var(--dang)',
                      }}
                    >
                      <Icon name="block" size={14} />1 задача blocked
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card card--pad" style={{ padding: '12px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="card__title">Sprint 24</div>
              <span
                className="badge badge--sm"
                style={{ background: 'var(--ac-soft)', color: 'var(--ac-tx)' }}
              >
                активен
              </span>
              <span className="mono spacer" style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
                осталось 4 дня
              </span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 4 }}>
              12 – 25 августа
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 11 }}>
              <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                12/34
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
                задач выполнено · 34/52 SP
              </span>
            </div>
            <div
              className="bar"
              style={{ marginTop: 8, display: 'flex', height: 6 }}
              aria-label="Прогресс спринта"
            >
              <div className="bar__fill" style={{ width: '35%', background: 'var(--ok)' }} />
              <div className="bar__fill" style={{ width: '24%', background: 'var(--ac)' }} />
              <div className="bar__fill" style={{ width: '15%', background: 'var(--warn)' }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 9 }}>
              {SPRINT_BARS.map((sb) => (
                <div
                  key={sb.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: 'var(--tx2)',
                  }}
                >
                  <span
                    style={{ width: 7, height: 7, borderRadius: 2, background: sb.c }}
                  />
                  {sb.label} {sb.n}
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 11,
                paddingTop: 10,
                borderTop: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11.5,
                  color: 'var(--dang)',
                }}
              >
                <Icon name="block" size={15} />1 blocked
              </div>
              <button
                type="button"
                className="btn btn--link spacer"
                onClick={() => nav('/backlog')}
              >
                Открыть спринт
                <Icon name="arrow_forward" size={15} />
              </button>
            </div>
          </section>

          <section className="card card--clip">
            <div className="card__head">
              <div className="card__title">Упоминания и обновления</div>
              <span className="spacer" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                {MENTIONS.filter((m) => m.unread).length} новых
              </span>
            </div>
            {MENTIONS.map((m) => {
              const p = PEOPLE[m.who]
              return (
                <div
                  key={m.key + m.time}
                  className="row row--static"
                  onClick={() => nav(`/tasks/${m.key}`)}
                  style={{
                    gridTemplateColumns: '24px minmax(0,1fr)',
                    height: 'auto',
                    padding: '9px 13px',
                    cursor: 'pointer',
                    background: m.unread ? 'var(--ac-soft)' : 'transparent',
                  }}
                >
                  <span className="av av--md" style={{ background: p.bg, color: p.fg }}>
                    {p.who}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name={m.icon} size={14} color={m.icFg} />
                      <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{m.kind}</span>
                      <TaskKey>{m.key}</TaskKey>
                      <span
                        className="mono spacer"
                        style={{ fontSize: 10.5, color: 'var(--tx3)' }}
                      >
                        {m.time}
                      </span>
                    </span>
                    <span
                      className="pretty"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: 'var(--tx2)',
                        marginTop: 3,
                        lineHeight: 1.45,
                      }}
                    >
                      {m.text}
                    </span>
                  </span>
                </div>
              )
            })}
          </section>

          <section className="card card--pad" style={{ padding: '12px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <div className="card__title">Недавняя активность</div>
              <span className="spacer" style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
                сегодня
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ACTIVITY.map((a, i) => (
                <div key={a.key + i} className="tl" style={{ gridTemplateColumns: '20px minmax(0,1fr)' }}>
                  <div className="tl__rail">
                    <div
                      className="tl__dot"
                      style={{ width: 20, height: 20, background: a.bg, color: a.fg }}
                    >
                      <Icon name={a.icon} size={13} />
                    </div>
                    {i < ACTIVITY.length - 1 && <div className="tl__line" />}
                  </div>
                  <div style={{ paddingTop: 1 }}>
                    <div className="pretty" style={{ fontSize: 12, color: 'var(--tx2)' }}>
                      <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{a.who}</span>{' '}
                      {a.what}
                    </div>
                    <div className="tl__meta">
                      {a.key} · {a.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
