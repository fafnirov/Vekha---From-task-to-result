import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Empty, Executor, Icon, PriorityChip, Progress, SectionTitle, StatusBadge, TaskKey } from '../components/ui'
import { dueColor } from '../data/catalog'
import { useDashboard } from '../api/hooks'
import { useSession } from '../store/session'
import { useUi } from '../store/ui'
import type { AttentionKind } from '../data/types'

/*
 * Вкладки повторяют виды поводов с сервера (REASONS в routes/feed.ts).
 * Двух не хватало — «срок близко» и «ждёт решения», — и строки этих
 * видов не открывались ни одной вкладкой: их было видно только на «Всё»,
 * и никакая вкладка их не объясняла.
 */
const ATTENTION_TABS: { value: 'all' | AttentionKind; label: string }[] = [
  { value: 'all', label: 'Всё' },
  { value: 'overdue', label: 'Просрочено' },
  { value: 'blocked', label: 'Блокировки' },
  { value: 'today', label: 'Сегодня' },
  { value: 'soon', label: 'Срок близко' },
  { value: 'review', label: 'Ждёт решения' },
  { value: 'mention', label: 'Упоминания' },
  { value: 'noassignee', label: 'Без исполнителя' },
]

export function Home() {
  const nav = useNavigate()
  const ui = useUi()
  const { me } = useSession()
  const dashboard = useDashboard()
  const [tab, setTab] = useState<'all' | AttentionKind>('all')

  const data = dashboard.data
  const reasons = data?.reasons

  /*
   * Пока сводка не пришла, экран не имеет права утверждать, что всё
   * хорошо. Раньше отсутствие данных читалось как «просрочек нет,
   * задач нет, проектов нет» — и через долю секунды всё это разом
   * подменялось настоящими цифрами.
   */
  const loading = dashboard.isLoading

  const attention = (data?.attention ?? []).filter((a) => tab === 'all' || a.kind === tab)

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <div className="page__title">
            {greeting}, {me?.name.split(' ')[0]}
          </div>
          <div className="page__note" style={{ marginLeft: 0 }}>
            {loading ? '' : data?.sprint
              ? `${data.sprint.name} · осталось ${data.sprint.daysLeft} дн.`
              : 'Активного спринта нет'}
          </div>
        </div>
        <button type="button" className="btn btn--primary spacer" onClick={ui.openCreateModal}>
          <Icon name="add" size={16} />
          Задача
        </button>
      </div>

      {/* ── KPI ────────────────────────────────────────────────────────── */}
      <div className="home__kpis">
        {(data?.kpis ?? []).map((k) => (
          <div key={k.label} className="card card--pad kpi">
            <div className="kpi__row">
              <Icon name={k.icon} size={17} color={k.fg} />
              <span className="kpi__label">{k.label}</span>
            </div>
            <div className="kpi__value mono" style={{ color: k.fg }}>
              {k.value}
            </div>
            <div className="kpi__note">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px', marginTop: 12 }}>
        <div className="stack">
          {/* ── Требует внимания ─────────────────────────────────────── */}
          <section className="card card--clip">
            <div className="card__head">
              <div className="card__title">Требует внимания</div>
              <span className="count-pill">{attention.length}</span>
              <div className="spacer home__tabs">
                {ATTENTION_TABS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={t.value === tab ? 'tag tag--outline tag--on' : 'tag tag--outline'}
                    onClick={() => setTab(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && <div className="skel skel--block" style={{ height: 120, margin: 13 }} />}

            {!loading && attention.length === 0 && (
              <Empty
                icon="task_alt"
                title={tab === 'all' ? 'Всё под контролем' : 'По этому фильтру ничего нет'}
                text={
                  tab === 'all'
                    ? 'Нет просрочек, блокировок и задач без исполнителя.'
                    : 'Выберите «Всё», чтобы увидеть остальные поводы.'
                }
              />
            )}

            {attention.map((row) => {
              const reason = reasons?.[row.kind]
              const task = row.task
              return (
                <Link key={row.key} to={`/tasks/${row.key}`} className="att">
                  <span className="att__thumb" style={{ background: reason?.bg, color: reason?.fg }}>
                    <Icon name={reason?.icon ?? 'info'} size={16} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <TaskKey>{row.key}</TaskKey>
                      <span className="ellipsis" style={{ fontSize: 13 }}>
                        {task.title}
                      </span>
                    </span>
                    <span className="att__meta" style={{ color: reason?.fg }}>
                      {reason?.reason} · {row.meta}
                    </span>
                  </span>
                  <Executor who={task.who} team={task.team} teamAbbr={task.teamAbbr} teamBg={task.teamBg} teamFg={task.teamFg} size="md" />
                  <span className="att__bar" style={{ background: reason?.bar }} />
                </Link>
              )
            })}
          </section>

          {/* ── Мои задачи ───────────────────────────────────────────── */}
          <section className="card card--clip">
            <div className="card__head">
              <div className="card__title">Мои задачи</div>
              <span className="count-pill">{data?.myTasks.length ?? 0}</span>
              <button
                type="button"
                className="btn btn--link spacer"
                onClick={() => nav('/tasks?assignee=' + (me?.code ?? ''))}
              >
                Все мои задачи
              </button>
            </div>

            {loading && <div className="skel skel--block" style={{ height: 96, margin: 13 }} />}

            {!loading && (data?.myTasks.length ?? 0) === 0 && (
              <Empty icon="assignment_turned_in" title="Пусто" text="На вас сейчас нет открытых задач." />
            )}

            {(data?.myTasks ?? []).slice(0, 8).map((t) => (
              <div
                key={t.key}
                className="row"
                style={{ gridTemplateColumns: '92px minmax(0,1fr) 118px 30px 68px', gap: 8 }}
                onClick={() => nav(`/tasks/${t.key}`)}
              >
                <TaskKey>{t.key}</TaskKey>
                <span className="ellipsis" style={{ fontSize: 13 }}>
                  {t.title}
                </span>
                <StatusBadge status={t.status} category={t.statusCategory} small />
                <PriorityChip priority={t.priority} small />
                <span className="mono" style={{ fontSize: 12, color: dueColor(t.dueState), textAlign: 'right' }}>
                  {t.due}
                </span>
              </div>
            ))}
          </section>

          {/* ── Проекты ──────────────────────────────────────────────── */}
          <section className="card card--pad">
            <SectionTitle
              right={
                <button type="button" className="btn btn--link" onClick={() => nav('/projects')}>
                  Все проекты
                </button>
              }
            >
              Мои проекты
            </SectionTitle>

            {loading ? (
              <div className="skel skel--block" style={{ height: 72 }} />
            ) : (data?.projects ?? []).length === 0 ? (
              /* Пустой блок читался бы как «проектов нет», хотя они есть —
                 просто ни один не ваш. */
              <Empty
                icon="folder_open"
                title="Вы не участвуете ни в одном проекте"
                text="Сюда попадают проекты, где вы руководитель или исполняете задачу."
                action={
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => nav('/projects')}>
                    Посмотреть все проекты
                  </button>
                }
              />
            ) : (
              <div className="home__projects">
                {(data?.projects ?? []).map((p) => (
                  <Link key={p.id} to={`/projects/${encodeURIComponent(p.name)}`} className="home__project">
                    <span className="project__mark" style={{ background: p.bg, color: p.fg }}>
                      {p.abbr}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="ellipsis" style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>
                        {p.name}
                      </span>
                      <Progress pct={p.pct} color={p.fg} variant="thin" style={{ marginTop: 6 }} />
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: p.atRisk ? 'var(--dang)' : 'var(--tx2)' }}>
                      {p.pct}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Правая колонка ─────────────────────────────────────────── */}
        <aside className="stack">
          {data?.sprint && (
            <section className="card card--pad">
              <SectionTitle>Спринт</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{data.sprint.name}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                  {data.sprint.range}
                </span>
              </div>
              {data.sprint.goal && (
                <p className="pretty" style={{ fontSize: 12, color: 'var(--tx2)', margin: '6px 0 0' }}>
                  {data.sprint.goal}
                </p>
              )}
              <div className="home__sprint">
                <div>
                  <b className="mono">{data.sprint.donePoints}</b>
                  <span>из {data.sprint.points} баллов</span>
                </div>
                <div>
                  <b className="mono">{data.sprint.tasks}</b>
                  <span>задач</span>
                </div>
                <div>
                  <b className="mono">{data.sprint.daysLeft}</b>
                  <span>дней</span>
                </div>
              </div>
              <Progress
                pct={`${data.sprint.points ? Math.round((data.sprint.donePoints / data.sprint.points) * 100) : 0}%`}
                color="var(--ok)"
                style={{ marginTop: 10 }}
              />
              <button
                type="button"
                className="btn btn--secondary"
                style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
                onClick={() => nav('/backlog')}
              >
                Планирование
              </button>
            </section>
          )}

          <section className="card card--clip">
            <div className="card__head">
              <div className="card__title">Упоминания и проверка</div>
            </div>
            {!loading && (data?.mentions.length ?? 0) === 0 && (
              <div className="home__none">Пока ничего</div>
            )}
            {(data?.mentions ?? []).map((m) => (
              <Link key={m.id} to={m.key ? `/tasks/${m.key}` : '/'} className="home__mention">
                <Avatar id={m.who} size="md" />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="home__mention-head">
                    <Icon name={m.icon} size={14} color={m.icFg} />
                    <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{m.kind}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                      {m.key} · {m.time}
                    </span>
                  </span>
                  <span className="home__mention-text">{m.text}</span>
                </span>
                {m.unread && <span className="dot-badge" style={{ position: 'static' }} />}
              </Link>
            ))}
          </section>

          <section className="card card--clip">
            <div className="card__head">
              <div className="card__title">Активность</div>
            </div>
            {!loading && (data?.activity ?? []).length === 0 && (
              <div className="home__none">Пока ничего</div>
            )}

            {(data?.activity ?? []).length > 0 && (
            <div className="tl" style={{ padding: '10px 13px 13px' }}>
              {(data?.activity ?? []).map((a, i) => (
                <div key={a.id} className="tl__item">
                  <span className="tl__rail">
                    <span className="tl__dot" style={{ background: a.bg, color: a.fg }}>
                      <Icon name={a.icon} size={13} />
                    </span>
                    {i < (data?.activity ?? []).length - 1 && <span className="tl__line" />}
                  </span>
                  <span className="tl__body">
                    <span style={{ fontSize: 12, lineHeight: 1.45 }}>
                      <b style={{ fontWeight: 600 }}>{a.who}</b> {a.what}
                    </span>
                    <span className="tl__meta">
                      <Link to={`/tasks/${a.key}`} className="mono">
                        {a.key}
                      </Link>
                      <span>·</span>
                      <span>{a.time}</span>
                    </span>
                  </span>
                </div>
              ))}
            </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
