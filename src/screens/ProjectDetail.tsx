import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Empty,
  Icon,
  PriorityChip,
  Progress,
  StatusBadge,
  TaskKey,
  UnderlineTabs,
} from '../components/ui'
import { dueColor } from '../data/catalog'
import { api } from '../api/client'
import { useApiMutation, useProject } from '../api/hooks'
import { useSession } from '../store/session'
import { useUi } from '../store/ui'
import { useApp } from '../store/app'

type TabId = 'overview' | 'tasks' | 'gantt'

const TABS: { value: TabId; label: string }[] = [
  { value: 'overview', label: 'Обзор' },
  { value: 'tasks', label: 'Задачи' },
  { value: 'gantt', label: 'Диаграмма Ганта' },
]

const RISK_TONE: Record<string, { bg: string; fg: string; icon: string }> = {
  high: { bg: 'var(--dang-bg)', fg: 'var(--dang)', icon: 'error' },
  medium: { bg: 'var(--warn-bg)', fg: 'var(--warn)', icon: 'warning' },
  low: { bg: 'var(--n-bg)', fg: 'var(--tx2)', icon: 'info' },
}

export function ProjectDetail() {
  const { name = '' } = useParams()
  const nav = useNavigate()
  const ui = useUi()
  const { can, list: people } = useSession()
  const { toast, toastError } = useApp()

  const detail = useProject(decodeURIComponent(name))
  const [tab, setTab] = useState<TabId>('overview')
  const [milestoneOpen, setMilestoneOpen] = useState(false)

  const addMilestone = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.post(`/api/projects/${id}/milestones`, body),
    ['projects'],
  )
  const patchMilestone = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.patch(`/api/milestones/${id}`, body),
    ['projects'],
  )

  if (detail.isLoading) {
    return (
      <div className="page">
        <div className="skel skel--block" style={{ height: 260 }} />
      </div>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="page">
        <Empty
          icon="folder_off"
          title="Проект не найден"
          text={`Проекта «${decodeURIComponent(name)}» нет.`}
          action={
            <button type="button" className="btn btn--primary" onClick={() => nav('/projects')}>
              Ко всем проектам
            </button>
          }
        />
      </div>
    )
  }

  const { project, tasks, milestones, gantt, ganttHeader, risks } = detail.data
  const manage = can('sprint.manage')

  return (
    <div className="page">
      <div className="page__head">
        <span className="project__mark project__mark--lg" style={{ background: project.bg, color: project.fg }}>
          {project.abbr}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="page__title">{project.name}</div>
          <div className="page__note" style={{ marginLeft: 0 }}>
            {project.queue} · лид {people.find((p) => p.code === project.lead)?.name ?? project.lead} · до{' '}
            {project.due}
          </div>
        </div>
        <span className="badge" style={{ background: project.stBg, color: project.stFg }}>
          {project.state}
        </span>
        <button type="button" className="btn btn--primary spacer" onClick={ui.openCreateModal}>
          <Icon name="add" size={16} />
          Задача
        </button>
      </div>

      <div className="project__stats">
        <Stat label="Готово" value={`${project.done} / ${project.total}`} note={project.pct} />
        <Stat
          label="В работе"
          value={String(tasks.filter((t) => t.statusCategory === 'inprogress').length)}
          note="задач"
        />
        <Stat
          label="Заблокировано"
          value={String(tasks.filter((t) => t.statusCategory === 'blocked').length)}
          note="задач"
          tone={tasks.some((t) => t.statusCategory === 'blocked') ? 'var(--dang)' : undefined}
        />
        <Stat
          label="Story points"
          value={String(tasks.reduce((sum, t) => sum + t.est, 0))}
          note="в проекте"
        />
      </div>

      <Progress pct={project.pct} color={project.fg} style={{ margin: '10px 0 4px' }} />

      <div style={{ marginTop: 8 }}>
        <UnderlineTabs
          options={TABS.map((t) => ({
            ...t,
            count: t.value === 'tasks' ? String(tasks.length) : undefined,
          }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* ── Обзор ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px', marginTop: 12 }}>
          <section className="card card--pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div className="card__title">Вехи</div>
              {manage && (
                <button type="button" className="btn btn--link spacer" onClick={() => setMilestoneOpen(true)}>
                  Добавить веху
                </button>
              )}
            </div>

            {milestones.length === 0 && <div className="task__none">Вех пока нет</div>}

            <div className="tl">
              {milestones.map((m) => (
                <div key={m.id} className="tl__rail">
                  <span className="tl__dot" style={{ background: m.bg, color: m.fg }}>
                    <Icon name={m.icon} size={13} />
                  </span>
                  <span className="tl__line" />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 13 }}>{m.title}</b>
                      <span className="badge badge--sm" style={{ background: m.bg, color: m.fg }}>
                        {m.state}
                      </span>
                      {manage && m.stateKey !== 'done' && (
                        <button
                          type="button"
                          className="btn btn--link"
                          style={{ fontSize: 11 }}
                          onClick={() =>
                            void patchMilestone
                              .mutateAsync({ id: m.id, body: { state: 'done' } })
                              .then(() => toast('Веха закрыта', m.title, 'ok'))
                              .catch(toastError)
                          }
                        >
                          отметить выполненной
                        </button>
                      )}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--tx2)', marginTop: 2 }}>
                      {m.note}
                    </span>
                    <span className="tl__meta" style={{ color: m.dateFg }}>
                      {m.date}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <aside className="stack">
            <section className="card card--pad">
              <div className="card__title" style={{ marginBottom: 10 }}>
                Риски
              </div>
              {risks.length === 0 && (
                <div className="task__none" style={{ padding: 0 }}>
                  Рисков не обнаружено
                </div>
              )}
              {risks.map((r) => {
                const tone = RISK_TONE[r.level]
                return (
                  <div key={r.title} className="risk">
                    <span className="risk__icon" style={{ background: tone.bg, color: tone.fg }}>
                      <Icon name={tone.icon} size={15} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 13, display: 'block' }}>{r.title}</b>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                        {r.note}
                      </span>
                    </span>
                  </div>
                )
              })}
            </section>

            {project.description && (
              <section className="card card--pad">
                <div className="card__title" style={{ marginBottom: 8 }}>
                  О проекте
                </div>
                <p className="pretty" style={{ fontSize: 13, color: 'var(--tx2)', margin: 0 }}>
                  {project.description}
                </p>
              </section>
            )}
          </aside>
        </div>
      )}

      {/* ── Задачи ─────────────────────────────────────────────────────── */}
      {tab === 'tasks' && (
        <section className="card card--clip" style={{ marginTop: 12 }}>
          {tasks.length === 0 && (
            <Empty icon="checklist" title="Задач нет" text="Создайте первую задачу проекта." />
          )}
          {tasks.map((t) => (
            <div
              key={t.key}
              className="row"
              style={{ gridTemplateColumns: '96px minmax(0,1fr) 124px 30px 30px 78px 50px', gap: 8 }}
              onClick={() => nav(`/tasks/${t.key}`)}
            >
              <TaskKey>{t.key}</TaskKey>
              <span className="ellipsis" style={{ fontSize: 13 }}>
                {t.title}
              </span>
              <StatusBadge status={t.status} category={t.statusCategory} />
              <PriorityChip priority={t.priority} small />
              <Avatar id={t.who} size="md" />
              <span className="mono" style={{ fontSize: 12, color: dueColor(t.dueState) }}>
                {t.due}
              </span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--tx2)', textAlign: 'right' }}>
                {t.est || '—'}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* ── Гант ───────────────────────────────────────────────────────── */}
      {tab === 'gantt' && (
        <section className="card card--pad" style={{ marginTop: 12, overflowX: 'auto' }}>
          {gantt.length === 0 ? (
            <Empty
              icon="timeline"
              title="Нечего показать"
              text="Диаграмма строится по задачам с дедлайнами и по вехам проекта."
            />
          ) : (
            <div style={{ minWidth: 720 }}>
              <div
                className="gantt__track"
                style={{ gridTemplateColumns: `220px repeat(${ganttHeader.length},1fr)` }}
              >
                <span />
                {ganttHeader.map((h, i) => (
                  <span key={`${h}-${i}`} className="gantt__month">
                    {h}
                  </span>
                ))}
              </div>

              {gantt.map((row, i) => (
                <div
                  key={`${row.label}-${i}`}
                  className="gantt__row"
                  style={{ gridTemplateColumns: `220px repeat(${ganttHeader.length},1fr)` }}
                  onClick={() => row.key && nav(`/tasks/${row.key}`)}
                >
                  <span className="ellipsis gantt__label" title={row.label}>
                    {row.label}
                  </span>
                  <span
                    className="gantt__cells"
                    style={{ gridColumn: `2 / span ${ganttHeader.length}` }}
                  >
                    <span
                      className={row.milestone ? 'gantt__bar gantt__bar--milestone' : 'gantt__bar'}
                      style={{
                        left: `${(row.start / ganttHeader.length) * 100}%`,
                        width: `${(row.dur / ganttHeader.length) * 100}%`,
                        background: row.c,
                      }}
                      title={`${row.dates}${row.status ? ` · ${row.status}` : ''}`}
                    >
                      {!row.milestone && row.pct && (
                        <span className="gantt__fill" style={{ width: row.pct }} />
                      )}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {milestoneOpen && (
        <MilestoneDialog
          busy={addMilestone.isPending}
          onClose={() => setMilestoneOpen(false)}
          onSave={async (body) => {
            try {
              await addMilestone.mutateAsync({ id: project.id, body })
              toast('Веха добавлена', String(body.title), 'ok')
              setMilestoneOpen(false)
            } catch (err) {
              toastError(err)
            }
          }}
        />
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone?: string
}) {
  return (
    <div className="card card--pad kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value mono" style={{ color: tone }}>
        {value}
      </div>
      <div className="kpi__note">{note}</div>
    </div>
  )
}

function MilestoneDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => void
}) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [state, setState] = useState('planned')

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 460, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Новая веха"
      >
        <div className="modal__head">
          <Icon name="flag" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Новая веха</div>
          <button type="button" className="btn btn--icon-quiet spacer" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="modal__body">
          <label className="label">
            <span>Название</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>
          <label className="label">
            <span>Комментарий</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="grid-2">
            <label className="label">
              <span>Дата</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="label">
              <span>Состояние</span>
              <select className="select" value={state} onChange={(e) => setState(e.target.value)}>
                <option value="planned">запланирована</option>
                <option value="active">в работе</option>
                <option value="done">выполнена</option>
              </select>
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
            disabled={busy || !title.trim()}
            onClick={() => onSave({ title, note, date, state })}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
