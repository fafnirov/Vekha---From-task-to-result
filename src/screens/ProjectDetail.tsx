import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Icon,
  PriorityChip,
  Progress,
  Segmented,
  StatusBadge,
  TaskKey,
} from '../components/ui'
import { ACTIVITY } from '../data/feed'
import { PEOPLE, dueColor } from '../data/catalog'
import {
  GANTT,
  GANTT_HEADER,
  GANTT_LEGEND,
  MILESTONES,
  findProject,
} from '../data/projects'
import { TASKS } from '../data/tasks'
import type { PersonId } from '../data/types'
import { useApp } from '../store/app'

const TABS = [
  { k: 'overview', label: 'Обзор' },
  { k: 'tasks', label: 'Задачи' },
  { k: 'board', label: 'Доска', to: '/board' },
  { k: 'backlog', label: 'Бэклог', to: '/backlog' },
  { k: 'timeline', label: 'Timeline' },
  { k: 'activity', label: 'Активность' },
  { k: 'settings', label: 'Настройки', to: '/workflow' },
] as const

type TabKey = (typeof TABS)[number]['k']

const SCALES = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
] as const

const RISKS = [
  {
    text: '2 просроченные задачи',
    note: 'LMS-23 · VEKHA-141',
    icon: 'schedule',
    fg: 'var(--dang)',
    bg: 'var(--dang-bg)',
  },
  {
    text: '1 задача blocked',
    note: 'ждёт ответа партнёра по LMS',
    icon: 'block',
    fg: 'var(--dang)',
    bg: 'var(--dang-bg)',
  },
  {
    text: 'Milestone через 3 дня',
    note: 'Разработка ядра интерфейса · 29 августа',
    icon: 'flag',
    fg: 'var(--warn)',
    bg: 'var(--warn-bg)',
  },
  {
    text: 'Дмитрий перегружен',
    note: '18 из 16 SP в Sprint 24',
    icon: 'person_alert',
    fg: 'var(--warn)',
    bg: 'var(--warn-bg)',
  },
]

const STATUS_PROGRESS = [
  { label: 'Done', n: 34, pct: '65%', c: 'var(--ok)' },
  { label: 'In Progress', n: 9, pct: '17%', c: 'var(--ac)' },
  { label: 'Review', n: 4, pct: '8%', c: 'var(--warn)' },
  { label: 'Testing', n: 3, pct: '6%', c: 'var(--vio)' },
  { label: 'Blocked', n: 2, pct: '4%', c: 'var(--dang)' },
]

const PROJECT_TEAM: { id: PersonId; tasks: number }[] = [
  { id: 'AK', tasks: 13 },
  { id: 'DS', tasks: 18 },
  { id: 'MN', tasks: 8 },
  { id: 'IV', tasks: 5 },
  { id: 'PG', tasks: 6 },
]

export function ProjectDetail() {
  const { name = 'Platform Redesign' } = useParams()
  const nav = useNavigate()
  const { statusOf } = useApp()
  const [tab, setTab] = useState<TabKey>('overview')
  const [scale, setScale] = useState<(typeof SCALES)[number]['value']>('week')

  const project = findProject(decodeURIComponent(name))
  const tasks = useMemo(
    () => TASKS.filter((t) => t.project === project.name),
    [project.name],
  )

  const kpis = [
    { label: 'Прогресс', value: project.pct, note: `${project.done} из ${project.total} задач`, fg: 'var(--tx)' },
    { label: 'В работе', value: '9', note: 'из них 2 в риске', fg: 'var(--ac)' },
    { label: 'Просрочено', value: '2', note: 'LMS-23, VEKHA-141', fg: 'var(--dang)' },
    { label: 'До дедлайна', value: '22д', note: '12 сентября', fg: 'var(--tx)' },
  ]

  return (
    <div style={{ minHeight: '100%' }}>
      <div
        style={{
          padding: '14px 18px 0',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: project.bg,
              color: project.fg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              flex: 'none',
            }}
          >
            {project.abbr}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>
                {project.name}
              </div>
              <span
                className="badge badge--sm"
                style={{ background: project.stBg, color: project.stFg }}
              >
                {project.state}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 2 }}>
              Очередь {project.queue} · 12 мая – 12 сентября · лид{' '}
              {PEOPLE[project.lead].name}
            </div>
          </div>
          <div className="spacer" style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn--secondary" onClick={() => nav('/board')}>
              <Icon name="view_kanban" size={16} />
              Доска
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => nav('/reports')}>
              <Icon name="monitoring" size={16} />
              Отчёт
            </button>
          </div>
        </div>

        <div className="tabs" style={{ marginTop: 12 }}>
          {TABS.map((t) => (
            <button
              key={t.k}
              type="button"
              className={tab === t.k ? 'tab tab--on' : 'tab'}
              style={{ padding: '0 12px' }}
              onClick={() => ('to' in t && t.to ? nav(t.to) : setTab(t.k))}
            >
              {t.label}
              <span className="tab__underline" />
            </button>
          ))}
        </div>
      </div>

      {(tab === 'overview' || tab === 'activity') && (
        <div
          className="split"
          style={{
            padding: '14px 18px 30px',
            gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)',
          }}
        >
          <div className="stack">
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}
            >
              {kpis.map((k) => (
                <div key={k.label} className="card" style={{ padding: '11px 12px', borderRadius: 9 }}>
                  <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{k.label}</div>
                  <div
                    className="mono"
                    style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: k.fg }}
                  >
                    {k.value}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                    {k.note}
                  </div>
                </div>
              ))}
            </div>

            <section className="card card--pad">
              <div className="card__title" style={{ marginBottom: 10 }}>
                Вехи
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {MILESTONES.map((m, i) => (
                  <div
                    key={m.title}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22px minmax(0,1fr) auto',
                      gap: 10,
                      alignItems: 'start',
                      paddingBottom: 13,
                    }}
                  >
                    <div className="tl__rail">
                      <div className="tl__dot" style={{ background: m.bg, color: m.fg }}>
                        <Icon name={m.icon} size={14} />
                      </div>
                      {i < MILESTONES.length - 1 && <div className="tl__line" />}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{m.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 2 }}>
                        {m.note}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 11.5, color: m.dateFg }}>
                        {m.date}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{m.state}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card card--clip">
              <div className="card__head">
                <div className="card__title">Задачи проекта</div>
                <button
                  type="button"
                  className="btn btn--link spacer"
                  onClick={() => nav('/tasks')}
                >
                  Открыть в списке
                </button>
              </div>
              {tasks.map((t) => (
                <div
                  key={t.key}
                  className="row"
                  style={{
                    gridTemplateColumns: '84px minmax(0,1fr) 118px 30px 26px 74px',
                  }}
                  onClick={() => nav(`/tasks/${t.key}`)}
                >
                  <TaskKey>{t.key}</TaskKey>
                  <span className="ellipsis" style={{ fontSize: 12.5 }}>
                    {t.title}
                  </span>
                  <StatusBadge status={statusOf(t.key)} dot={false} />
                  <span style={{ justifySelf: 'center' }}>
                    <PriorityChip priority={t.priority} />
                  </span>
                  <Avatar id={t.who} />
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
          </div>

          <div className="stack">
            <section className="card card--pad">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div className="card__title">Риски</div>
                <span className="count-pill">{RISKS.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {RISKS.map((rk) => (
                  <div
                    key={rk.text}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22px minmax(0,1fr)',
                      gap: 9,
                      alignItems: 'start',
                      padding: '7px 8px',
                      borderRadius: 7,
                      background: 'var(--surface2)',
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: rk.bg,
                        color: rk.fg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={rk.icon} size={14} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 500 }}>
                        {rk.text}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 11,
                          color: 'var(--tx2)',
                          marginTop: 1,
                        }}
                      >
                        {rk.note}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card card--pad">
              <div className="card__title" style={{ marginBottom: 10 }}>
                Прогресс по статусам
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {STATUS_PROGRESS.map((ps) => (
                  <div key={ps.label}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11.5,
                        color: 'var(--tx2)',
                      }}
                    >
                      <span>{ps.label}</span>
                      <span className="mono">{ps.n}</span>
                    </div>
                    <Progress pct={ps.pct} color={ps.c} style={{ marginTop: 4 }} />
                  </div>
                ))}
              </div>
            </section>

            <section className="card card--pad">
              <div className="card__title" style={{ marginBottom: 10 }}>
                Участники
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PROJECT_TEAM.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar id={m.id} size="lg" title={false} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="ellipsis" style={{ fontSize: 12 }}>
                        {PEOPLE[m.id].name}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
                        {PEOPLE[m.id].role}
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--tx2)' }}>
                      {m.tasks}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card card--pad">
              <div className="card__title" style={{ marginBottom: 10 }}>
                Активность
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ACTIVITY.map((a, i) => (
                  <div
                    key={a.key + i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px minmax(0,1fr)',
                      gap: 9,
                    }}
                  >
                    <div
                      className="tl__dot"
                      style={{ width: 20, height: 20, background: a.bg, color: a.fg }}
                    >
                      <Icon name={a.icon} size={13} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
                        <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{a.who}</span>{' '}
                        {a.what}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
                        {a.key} · {a.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div style={{ padding: '14px 18px 30px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 11,
              flexWrap: 'wrap',
            }}
          >
            <Segmented options={SCALES} value={scale} onChange={setScale} />
            <div style={{ display: 'flex', gap: 12, marginLeft: 10 }}>
              {GANTT_LEGEND.map((lg) => (
                <div
                  key={lg.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: 'var(--tx2)',
                  }}
                >
                  <span
                    style={{ width: 9, height: 9, borderRadius: 2, background: lg.c }}
                  />
                  {lg.label}
                </div>
              ))}
            </div>
            <div className="spacer" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" className="btn btn--secondary btn--sm">
                <Icon name="today" size={15} />
                Сегодня
              </button>
              <button type="button" className="btn btn--secondary btn--sm">
                <Icon name="fit_screen" size={15} />
                Вписать
              </button>
              <span style={{ fontSize: 11.5, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
                май – сентябрь 2026
              </span>
            </div>
          </div>

          <div className="card card--clip">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '300px minmax(0,1fr)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface2)',
              }}
            >
              <div
                className="vk-eyebrow"
                style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}
              >
                Этап / задача
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10,1fr)' }}>
                {GANTT_HEADER.map((h, i) => (
                  <div
                    key={h}
                    className="mono"
                    style={{
                      padding: '8px 0',
                      textAlign: 'center',
                      fontSize: 10.5,
                      color: i <= 4 ? 'var(--tx2)' : 'var(--tx3)',
                      borderLeft: '1px solid var(--border)',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
            </div>

            {GANTT.map((g) => {
              const h = g.phase ? 44 : g.milestone ? 32 : 40
              const barH = g.phase ? 16 : g.milestone ? 14 : 20
              return (
                <div
                  key={g.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '300px minmax(0,1fr)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) 90px 20px',
                      alignItems: 'center',
                      gap: 8,
                      height: h,
                      borderRight: '1px solid var(--border)',
                      padding: '0 10px',
                      paddingLeft: g.phase ? 10 : 24,
                    }}
                  >
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}
                    >
                      <Icon
                        name={g.phase ? 'folder' : g.milestone ? 'flag' : 'task_alt'}
                        size={15}
                        color={g.phase ? 'var(--tx2)' : 'var(--tx3)'}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span
                          className="ellipsis"
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: g.phase ? 600 : 450,
                          }}
                        >
                          {g.label}
                        </span>
                        <span
                          className="mono"
                          style={{
                            display: 'block',
                            fontSize: 10,
                            color: 'var(--tx3)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {g.dates}
                        </span>
                      </span>
                    </span>
                    {g.status ? (
                      <StatusBadge status={g.status} dot={false} small />
                    ) : (
                      <span />
                    )}
                    {g.who ? <Avatar id={g.who} size="xs" /> : <span />}
                  </div>

                  <div className="gantt__track" style={{ height: h }}>
                    <div
                      className="gantt__bar"
                      title={`${g.label} · ${g.dates}`}
                      style={{
                        left: `${g.start * 10}%`,
                        width: `${g.dur * 10}%`,
                        height: barH,
                        background: g.c,
                        borderRadius: g.milestone ? 4 : 6,
                      }}
                    >
                      {!g.milestone && <span className="gantt__grip" />}
                      <span
                        className="ellipsis"
                        style={{
                          fontSize: 10.5,
                          color: '#fff',
                          fontWeight: 500,
                          marginLeft: 5,
                        }}
                      >
                        {g.milestone ? '' : g.label.split(' · ').pop()}
                      </span>
                      {g.pct && (
                        <span
                          className="mono spacer"
                          style={{ fontSize: 10, color: '#fff', opacity: 0.85 }}
                        >
                          {g.pct}
                        </span>
                      )}
                      {!g.milestone && (
                        <span className="gantt__grip" style={{ marginLeft: 5 }} />
                      )}
                    </div>
                    <div className="gantt__today" style={{ left: '68%' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div style={{ padding: '14px 18px 30px' }}>
          <div className="card card--clip">
            {tasks.map((t) => (
              <div
                key={t.key}
                className="row"
                style={{
                  gridTemplateColumns: '88px minmax(0,1fr) 124px 32px 26px 90px 78px',
                }}
                onClick={() => nav(`/tasks/${t.key}`)}
              >
                <TaskKey>{t.key}</TaskKey>
                <span className="ellipsis" style={{ fontSize: 12.5 }}>
                  {t.title}
                </span>
                <StatusBadge status={statusOf(t.key)} dot={false} />
                <span style={{ justifySelf: 'center' }}>
                  <PriorityChip priority={t.priority} />
                </span>
                <Avatar id={t.who} />
                <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{t.sprint}</span>
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
          </div>
        </div>
      )}
    </div>
  )
}
