import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Empty, Progress, SectionTitle, TaskKey } from '../components/ui'
import { useBurndown, useQueues, useReports } from '../api/hooks'

const WEEK_OPTIONS = [8, 12, 16, 26]

export function Reports() {
  const nav = useNavigate()
  const [queue, setQueue] = useState('')
  const [weeks, setWeeks] = useState(8)

  const queues = useQueues()
  const reports = useReports({ queue: queue || undefined, weeks })
  const burndown = useBurndown({ queue: queue || undefined })

  const data = reports.data

  if (reports.isLoading) {
    return (
      <div className="page">
        <div className="skel skel--block" style={{ height: 320 }} />
      </div>
    )
  }

  /*
   * Сбой загрузки нельзя показывать нулями. Без этой ветки экран
   * подставлял пустые значения и утверждал «Просрочек нет, все сроки
   * соблюдаются» — то есть по неудавшемуся запросу выдавал заключение
   * о делах команды.
   */
  if (reports.isError || !data) {
    return (
      <div className="page">
        <div className="page__head">
          <div className="page__title">Отчёты</div>
        </div>
        <Empty
          icon="cloud_off"
          title="Не удалось загрузить отчёты"
          text="Проверьте связь и обновите страницу. Цифры ниже показывать нечем — лучше никаких, чем неверные."
        />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">Отчёты</div>
        <span className="page__note">всё считается по текущим данным трекера</span>

        <select
          className="select select--sm spacer"
          value={queue}
          onChange={(e) => setQueue(e.target.value)}
        >
          <option value="">Все очереди</option>
          {(queues.data ?? []).map((q) => (
            <option key={q.id} value={q.key}>
              {q.key}
            </option>
          ))}
        </select>
        <select
          className="select select--sm"
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
        >
          {WEEK_OPTIONS.map((w) => (
            <option key={w} value={w}>
              {w} недель
            </option>
          ))}
        </select>
      </div>

      <div className="home__kpis">
        {(data?.kpis ?? []).map((k) => (
          <div key={k.label} className="card card--pad kpi">
            <div className="kpi__label">{k.label}</div>
            <div className="kpi__value mono" style={{ color: k.fg }}>
              {k.value}
            </div>
            <div className="kpi__note" style={{ color: k.deltaFg }}>
              {k.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px', marginTop: 12 }}>
        <div className="stack">
          {/* ── Burndown ─────────────────────────────────────────────── */}
          <section className="card card--pad">
            <SectionTitle right={<span className="mono report__hint">{burndown.data?.sprint ?? '—'}</span>}>
              Сгорание спринта
            </SectionTitle>
            <Burndown points={burndown.data?.points ?? []} total={burndown.data?.total ?? 0} />
          </section>

          {/* ── Пропускная способность ───────────────────────────────── */}
          <section className="card card--pad">
            <SectionTitle right={<span className="report__hint">закрыто задач по неделям</span>}>
              Пропускная способность
            </SectionTitle>
            <div className="chart">
              {(data?.throughput ?? []).map((t) => (
                <div key={t.label} className="chart__col" title={`${t.label}: ${t.n}`}>
                  <span className="chart__value mono">{t.n}</span>
                  <span className="chart-bar" style={{ height: t.h }} />
                  <span className="chart__label mono">{t.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Нагрузка ─────────────────────────────────────────────── */}
          <section className="card card--pad">
            <SectionTitle right={<span className="report__hint">открытые баллы и распределение задач</span>}>
              Нагрузка сотрудников
            </SectionTitle>

            {(data?.workload ?? []).map((w) => (
              <div key={w.id} className="workload">
                <Avatar id={w.code} size="md" />
                <span className="ellipsis" style={{ fontSize: 13 }}>
                  {w.name}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--tx2)' }}>
                  {w.sp} б.
                </span>
                <span className="workload__bar">
                  <span style={{ width: w.doneW, background: 'var(--ok)' }} title={`Готово ${w.doneW}`} />
                  <span style={{ width: w.progW, background: 'var(--ac)' }} title={`В работе ${w.progW}`} />
                  <span style={{ width: w.todoW, background: 'var(--border2)' }} title={`Осталось ${w.todoW}`} />
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                  {w.tasks}
                </span>
              </div>
            ))}
          </section>
        </div>

        <aside className="stack">
          {/* ── Кольцо статусов ──────────────────────────────────────── */}
          <section className="card card--pad">
            <SectionTitle>Распределение по статусам</SectionTitle>
            <Donut slices={data?.statusSplit ?? []} />
          </section>

          {/* ── Метрики спринтов ─────────────────────────────────────── */}
          <section className="card card--pad">
            <SectionTitle>Спринты</SectionTitle>
            {(data?.sprintMetrics ?? []).length === 0 && (
              <div className="task__none" style={{ padding: 0 }}>
                Спринтов нет
              </div>
            )}
            {(data?.sprintMetrics ?? []).map((s) => (
              <div key={s.label} className="sprint-metric">
                <span style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                  {s.fact}/{s.plan} б.
                </span>
                <span className="mono" style={{ fontSize: 12, color: s.fg, width: 40, textAlign: 'right' }}>
                  {s.pct}
                </span>
                <Progress
                  pct={s.pct}
                  color={s.fg}
                  variant="thin"
                  style={{ gridColumn: '1 / -1', marginTop: 4 }}
                />
              </div>
            ))}
          </section>

          {/* ── Просрочки ────────────────────────────────────────────── */}
          <section className="card card--clip">
            <div className="card__head">
              <div className="card__title">Просрочки</div>
              <span className="count-pill">{data?.overdue.length ?? 0}</span>
            </div>
            {(data?.overdue ?? []).length === 0 && (
              <Empty icon="task_alt" title="Просрочек нет" text="Все сроки соблюдаются." />
            )}
            {(data?.overdue ?? []).map((o) => (
              <div
                key={o.key}
                className="row"
                style={{ gridTemplateColumns: '92px minmax(0,1fr) 70px', gap: 8 }}
                onClick={() => nav(`/tasks/${o.key}`)}
              >
                <TaskKey>{o.key}</TaskKey>
                <span className="ellipsis" style={{ fontSize: 12 }}>
                  {o.title}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--dang)', textAlign: 'right' }}>
                  {o.late}
                </span>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  )
}

/** Простой линейный график: остаток против идеальной прямой. */
function Burndown({
  points,
  total,
}: {
  points: { label: string; remaining: number; ideal: number }[]
  total: number
}) {
  const W = 560
  const H = 170
  const pad = 26

  const path = useMemo(() => {
    if (points.length < 2) return { real: '', ideal: '' }
    const max = Math.max(total, ...points.map((p) => p.remaining), 1)
    const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2)
    const y = (v: number) => H - pad - (v / max) * (H - pad * 2)
    const line = (get: (p: (typeof points)[number]) => number) =>
      points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ')
    return { real: line((p) => p.remaining), ideal: line((p) => p.ideal) }
  }, [points, total])

  if (points.length < 2) {
    return (
      <div className="task__none" style={{ padding: '20px 0' }}>
        Данных пока мало — график появится после нескольких дней спринта
      </div>
    )
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="report__chart"
        role="img"
        aria-label="Диаграмма сгорания: фактический остаток против идеального"
      >
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--border)" />
        <path d={path.ideal} fill="none" stroke="var(--border2)" strokeWidth={1.5} strokeDasharray="4 4" />
        <path d={path.real} fill="none" stroke="var(--ac)" strokeWidth={2} />
      </svg>
      <div className="report__legend">
        <span>
          <i style={{ background: 'var(--ac)' }} /> остаток
        </span>
        <span>
          <i style={{ background: 'var(--border2)' }} /> идеальный темп
        </span>
        <span className="spacer mono">{points[points.length - 1].remaining} б. осталось</span>
      </div>
    </div>
  )
}

function Donut({ slices }: { slices: { label: string; n: number; c: string }[] }) {
  const total = slices.reduce((sum, s) => sum + s.n, 0)
  if (total === 0) return <div className="task__none">Нет данных</div>

  let offset = 0
  const R = 54
  const C = 2 * Math.PI * R

  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="Распределение задач по статусам">
        {slices.map((s) => {
          const len = (s.n / total) * C
          const dash = `${len} ${C - len}`
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={s.c}
              strokeWidth="16"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          )
          offset += len
          return el
        })}
        <text x="70" y="66" textAnchor="middle" className="donut__num">
          {total}
        </text>
        <text x="70" y="82" textAnchor="middle" className="donut__cap">
          задач
        </text>
      </svg>

      <div className="donut__legend">
        {slices.map((s) => (
          <div key={s.label}>
            <i style={{ background: s.c }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <span className="mono">{s.n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
