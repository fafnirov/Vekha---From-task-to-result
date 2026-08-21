import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, Segmented } from '../components/ui'
import { PEOPLE } from '../data/catalog'
import { findTask } from '../data/tasks'
import {
  BURNDOWN_DAYS,
  OVERDUE,
  REPORT_KPIS,
  REPORT_WORKLOAD,
  SPRINT_METRICS,
  STATUS_SPLIT,
  THROUGHPUT,
  WIDGET_LIBRARY,
} from '../data/workspace'
import { useApp } from '../store/app'

const PERIODS = [
  { value: 'sprint', label: 'Спринт' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
] as const

const PERIOD_LABEL: Record<string, string> = {
  sprint: '12–25 авг',
  month: 'август',
  quarter: 'Q3 2026',
}

/** Conic-gradient stops for the status donut. */
function donutGradient(): string {
  const total = STATUS_SPLIT.reduce((s, x) => s + x.n, 0)
  let acc = 0
  const stops = STATUS_SPLIT.map((s) => {
    const from = (acc / total) * 360
    acc += s.n
    const to = (acc / total) * 360
    return `${s.c} ${from}deg ${to}deg`
  })
  return `conic-gradient(${stops.join(',')})`
}

export function Reports() {
  const nav = useNavigate()
  const { toast } = useApp()
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('sprint')
  const [loading, setLoading] = useState(false)
  const [widgetMenu, setWidgetMenu] = useState(false)

  const donut = useMemo(donutGradient, [])
  const total = STATUS_SPLIT.reduce((s, x) => s + x.n, 0)

  const refresh = () => {
    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      toast('Отчёты обновлены', `Период: ${PERIOD_LABEL[period]}`)
    }, 700)
  }

  return (
    <div className="page">
      <div className="page__head" style={{ flexWrap: 'wrap' }}>
        <div className="page__title">Отчёты</div>
        <Segmented options={PERIODS} value={period} onChange={setPeriod} style={{ marginLeft: 6 }} />
        <button type="button" className="btn btn--secondary spacer" onClick={refresh}>
          <Icon name="refresh" size={16} />
          Обновить
        </button>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setWidgetMenu(!widgetMenu)}
          >
            <Icon name="add" size={16} />
            Виджет
          </button>
          {widgetMenu && (
            <div
              className="menu"
              style={{ top: 32, right: 0, width: 236, maxHeight: 300, overflow: 'auto' }}
            >
              <div className="vk-eyebrow" style={{ padding: '5px 8px 6px' }}>
                Библиотека виджетов
              </div>
              {WIDGET_LIBRARY.map((wl) => (
                <button
                  key={wl.label}
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    setWidgetMenu(false)
                    toast('Виджет добавлен', wl.label)
                  }}
                >
                  <Icon name={wl.icon} size={16} color="var(--tx2)" />
                  <span style={{ flex: 1 }}>{wl.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => toast('Экспорт', 'Отчёт выгружается в XLSX', 'info')}
        >
          <Icon name="download" size={16} />
          Экспорт
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 10,
          marginBottom: 12,
        }}
      >
        {REPORT_KPIS.map((k) => (
          <div key={k.label} className="card" style={{ padding: '11px 12px', borderRadius: 9 }}>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 5 }}>
              <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: k.fg }}>
                {k.value}
              </span>
              <span style={{ fontSize: 11.5, color: k.deltaFg }}>{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      <div
        className="split"
        style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}
      >
        <div className="stack">
          <section className="card card--pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <Icon
                name="drag_indicator"
                size={16}
                color="var(--border2)"
                title="Перетащите, чтобы переставить виджет"
              />
              <div className="card__title">Burndown · Sprint 24</div>
              <span className="count-pill" style={{ fontSize: 10.5 }}>
                {PERIOD_LABEL[period]}
              </span>
              <div className="spacer" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--tx2)' }}>
                  <span style={{ width: 14, height: 2, background: 'var(--border2)' }} />
                  план
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--tx2)' }}>
                  <span style={{ width: 14, height: 2, background: 'var(--ac)' }} />
                  факт
                </div>
              </div>
            </div>
            {loading ? (
              <div className="skel skel--block" />
            ) : (
              <div style={{ position: 'relative', height: 168 }}>
                <svg
                  viewBox="0 0 520 168"
                  preserveAspectRatio="none"
                  style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
                  role="img"
                  aria-label="График сгорания задач спринта"
                >
                  <line x1="0" y1="42" x2="520" y2="42" stroke="var(--grid)" strokeWidth="1" />
                  <line x1="0" y1="84" x2="520" y2="84" stroke="var(--grid)" strokeWidth="1" />
                  <line x1="0" y1="126" x2="520" y2="126" stroke="var(--grid)" strokeWidth="1" />
                  <line x1="0" y1="167" x2="520" y2="167" stroke="var(--border)" strokeWidth="1" />
                  <polyline
                    points="0,8 74,32 148,56 222,80 296,104 370,128 444,152 518,166"
                    fill="none"
                    stroke="var(--border2)"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                  />
                  <polyline
                    points="0,8 74,26 148,48 222,52 296,86 370,96 444,124"
                    fill="none"
                    stroke="var(--ac)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <circle cx="444" cy="124" r="3.5" fill="var(--ac)" />
                </svg>
                <div
                  className="mono"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10.5,
                    color: 'var(--tx3)',
                    marginTop: 5,
                  }}
                >
                  {BURNDOWN_DAYS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="card card--pad">
            <div className="card__title" style={{ marginBottom: 12 }}>
              Закрытые задачи по неделям
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 132 }}>
              {THROUGHPUT.map((th) => (
                <div
                  key={th.label}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
                    {th.n}
                  </span>
                  <div
                    className="chart-bar"
                    style={{ height: th.h, background: 'var(--ac)' }}
                    title={`${th.label}: ${th.n} задач`}
                  />
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
                    {th.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card card--clip">
            <div className="card__head">
              <Icon name="schedule" size={16} color="var(--dang)" />
              <div className="card__title">Просрочки</div>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
                {OVERDUE.length} задачи
              </span>
            </div>
            {OVERDUE.map((o) => {
              const t = findTask(o.key)
              return (
                <div
                  key={o.key}
                  className="row"
                  style={{
                    gridTemplateColumns: '88px minmax(0,1fr) 26px 96px 84px',
                    height: 34,
                  }}
                  onClick={() => nav(`/tasks/${o.key}`)}
                >
                  <span className="key">{t.key}</span>
                  <span className="ellipsis" style={{ fontSize: 12.5 }}>
                    {t.title}
                  </span>
                  <Avatar id={t.who} />
                  <span className="ellipsis" style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
                    {t.project}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: 'var(--dang)',
                      fontWeight: 500,
                      textAlign: 'right',
                    }}
                  >
                    {o.late}
                  </span>
                </div>
              )
            })}
          </section>
        </div>

        <div className="stack">
          <section className="card card--pad">
            <div className="card__title" style={{ marginBottom: 12 }}>
              Распределение по статусам
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: '50%',
                  background: donut,
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                role="img"
                aria-label="Диаграмма распределения задач по статусам"
              >
                <div className="donut__hole">
                  <span className="mono" style={{ fontSize: 17, fontWeight: 600 }}>
                    {total}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--tx3)' }}>задач</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0, flex: 1 }}>
                {STATUS_SPLIT.map((ss) => (
                  <div
                    key={ss.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 11.5,
                      color: 'var(--tx2)',
                    }}
                  >
                    <span
                      style={{ width: 8, height: 8, borderRadius: 2, background: ss.c, flex: 'none' }}
                    />
                    <span className="ellipsis" style={{ flex: 1 }}>
                      {ss.label}
                    </span>
                    <span className="mono" style={{ color: 'var(--tx)' }}>
                      {ss.n}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card card--pad">
            <div className="card__title" style={{ marginBottom: 12 }}>
              Нагрузка по сотрудникам
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {REPORT_WORKLOAD.map((w) => (
                <div key={w.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Avatar id={w.id} title={false} />
                    <span className="ellipsis" style={{ fontSize: 12, flex: 1 }}>
                      {PEOPLE[w.id].name}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--tx2)' }}>
                      {w.sp} SP
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      height: 7,
                      borderRadius: 4,
                      overflow: 'hidden',
                      background: 'var(--n-bg)',
                    }}
                  >
                    <div style={{ width: w.doneW, background: 'var(--ok)' }} />
                    <div style={{ width: w.progW, background: 'var(--ac)' }} />
                    <div style={{ width: w.todoW, background: 'var(--border2)' }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card card--pad">
            <div className="card__title" style={{ marginBottom: 10 }}>
              Метрики спринтов
            </div>
            <div
              className="vk-eyebrow"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) 54px 54px 54px',
                gap: 8,
                padding: '0 4px 6px',
                letterSpacing: '0.03em',
              }}
            >
              <span>Спринт</span>
              <span style={{ textAlign: 'right' }}>План</span>
              <span style={{ textAlign: 'right' }}>Факт</span>
              <span style={{ textAlign: 'right' }}>%</span>
            </div>
            {SPRINT_METRICS.map((sm) => (
              <div
                key={sm.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) 54px 54px 54px',
                  gap: 8,
                  padding: '5px 4px',
                  borderTop: '1px solid var(--border)',
                  fontSize: 12,
                }}
              >
                <span>{sm.label}</span>
                <span className="mono" style={{ textAlign: 'right', color: 'var(--tx2)' }}>
                  {sm.plan}
                </span>
                <span className="mono" style={{ textAlign: 'right', color: 'var(--tx2)' }}>
                  {sm.fact}
                </span>
                <span
                  className="mono"
                  style={{ textAlign: 'right', color: sm.fg, fontWeight: 500 }}
                >
                  {sm.pct}
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
