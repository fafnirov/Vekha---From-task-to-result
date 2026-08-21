import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Icon,
  PriorityChip,
  Segmented,
  StatusBadge,
  TaskKey,
} from '../components/ui'
import { dueColor } from '../data/catalog'
import { TASKS } from '../data/tasks'
import {
  FAV_FILTERS,
  RECENT_FILTERS,
  SAVED_FILTERS,
  TEAM_FILTERS,
} from '../data/workspace'
import type { FilterCondition } from '../data/types'
import { useApp } from '../store/app'

const MODES = [
  { value: 'builder', label: 'Конструктор' },
  { value: 'query', label: 'Язык запросов' },
] as const

const INITIAL_CONDITIONS: FilterCondition[] = [
  {
    field: 'Очередь',
    op: 'входит в',
    icon: 'layers',
    values: ['VEKHA', 'REL'],
    vbg: 'var(--ac-soft)',
    vfg: 'var(--ac-tx)',
  },
  {
    field: 'Статус',
    op: 'входит в',
    icon: 'sync_alt',
    values: ['In Progress', 'Review'],
    vbg: 'var(--n-bg)',
    vfg: 'var(--tx2)',
  },
  {
    field: 'Дедлайн',
    op: 'раньше чем',
    icon: 'calendar_today',
    values: ['конец недели'],
    vbg: 'var(--warn-bg)',
    vfg: 'var(--warn)',
  },
]

const GROUP_CONDITIONS = [
  { join: 'или', field: 'Приоритет', icon: 'priority_high', op: 'равен', value: 'Critical', vbg: 'var(--dang-bg)', vfg: 'var(--dang)' },
  { join: 'или', field: 'Тег', icon: 'sell', op: 'содержит', value: 'release', vbg: 'var(--n-bg)', vfg: 'var(--tx2)' },
]

export function Filters() {
  const nav = useNavigate()
  const { statusOf, toast } = useApp()
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('builder')
  const [active, setActive] = useState('Мои открытые')
  const [conditions, setConditions] = useState(INITIAL_CONDITIONS)
  const [groupJoin, setGroupJoin] = useState<'OR' | 'AND'>('OR')
  const [hasGroup, setHasGroup] = useState(true)

  const results = TASKS.filter(
    (t) => ['In Progress', 'Review'].includes(statusOf(t.key)) || t.priority === 'Critical',
  )

  return (
    <div
      className="split"
      style={{ gridTemplateColumns: '212px minmax(0,1fr)', minHeight: '100%', gap: 0 }}
    >
      <aside className="filter-side">
        <div className="vk-eyebrow" style={{ padding: '0 6px 8px' }}>
          Избранные
        </div>
        {FAV_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={active === f.label ? 'filter-item filter-item--on' : 'filter-item'}
            onClick={() => setActive(f.label)}
          >
            <Icon name="push_pin" size={15} color="var(--ac)" />
            <span className="ellipsis" style={{ flex: 1 }}>
              {f.label}
            </span>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
              {f.n}
            </span>
          </button>
        ))}

        <div className="vk-eyebrow" style={{ padding: '12px 6px 8px' }}>
          Мои фильтры
        </div>
        {SAVED_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={active === f.label ? 'filter-item filter-item--on' : 'filter-item'}
            onClick={() => setActive(f.label)}
          >
            <Icon name={f.icon} size={16} color={f.icf} />
            <span className="ellipsis" style={{ flex: 1 }}>
              {f.label}
            </span>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
              {f.n}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="btn btn--dashed"
          style={{ width: '100%', marginTop: 8, justifyContent: 'flex-start' }}
          onClick={() => toast('Фильтр сохранён', 'Доступен вам и команде')}
        >
          <Icon name="add" size={15} />
          Новый фильтр
        </button>

        <div className="vk-sep" style={{ margin: '14px 4px' }} />

        <div className="vk-eyebrow" style={{ padding: '0 6px 8px' }}>
          Общие фильтры команды
        </div>
        {TEAM_FILTERS.map((tf) => (
          <div key={tf.label} className="filter-item" style={{ height: 28 }}>
            <Avatar id={tf.who} size="xs" title={false} />
            <span className="ellipsis" style={{ flex: 1 }}>
              {tf.label}
            </span>
            <Icon name="push_pin" size={14} color="var(--tx3)" title="Добавить в избранное" />
          </div>
        ))}

        <div className="vk-eyebrow" style={{ padding: '12px 6px 8px' }}>
          Недавние
        </div>
        {RECENT_FILTERS.map((rf) => (
          <button
            key={rf.label}
            type="button"
            className="filter-item"
            style={{ height: 28 }}
            onClick={() => setMode('query')}
          >
            <Icon name="history" size={15} color="var(--tx3)" />
            <span className="ellipsis" style={{ flex: 1 }}>
              {rf.label}
            </span>
          </button>
        ))}
      </aside>

      <div style={{ padding: '14px 16px 30px', minWidth: 0 }}>
        <div className="page__head">
          <div className="page__title">Расширенный поиск</div>
          <Segmented options={MODES} value={mode} onChange={setMode} style={{ marginLeft: 6 }} />
          <button
            type="button"
            className="btn btn--primary spacer"
            onClick={() => toast('Поиск выполнен', `${results.length} задач · 128 мс`)}
          >
            <Icon name="play_arrow" size={16} />
            Найти
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => toast('Фильтр сохранён', `«${active}» обновлён`)}
          >
            <Icon name="bookmark_add" size={16} />
            Сохранить
          </button>
        </div>

        {mode === 'builder' && (
          <section className="card card--pad" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conditions.map((cd, i) => (
                <div key={cd.field} className="cond">
                  <span className="cond__join">{i === 0 ? 'где' : 'и'}</span>
                  <button type="button" className="cond__pick">
                    <Icon name={cd.icon} size={15} color="var(--tx3)" />
                    <span style={{ flex: 1, textAlign: 'left' }}>{cd.field}</span>
                    <Icon name="expand_more" size={15} color="var(--tx3)" />
                  </button>
                  <button
                    type="button"
                    className="cond__pick"
                    style={{ justifyContent: 'space-between', color: 'var(--tx2)' }}
                  >
                    {cd.op}
                    <Icon name="expand_more" size={15} color="var(--tx3)" />
                  </button>
                  <div className="cond__values">
                    {cd.values.map((v) => (
                      <span
                        key={v}
                        className="badge"
                        style={{ background: cd.vbg, color: cd.vfg, height: 21 }}
                      >
                        {v}
                        <Icon name="close" size={13} />
                      </span>
                    ))}
                    <span style={{ fontSize: 12, color: 'var(--tx3)' }}>добавить…</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--icon-quiet btn--danger"
                    style={{ width: 28, height: 28 }}
                    aria-label={`Удалить условие ${cd.field}`}
                    onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                  >
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              ))}
            </div>

            {hasGroup && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '58px minmax(0,1fr)',
                  gap: 8,
                  marginTop: 8,
                  alignItems: 'start',
                }}
              >
                <span className="cond__join" style={{ paddingTop: 8 }}>
                  и
                </span>
                <div
                  style={{
                    border: '1px solid var(--ac-soft2)',
                    background: 'var(--ac-soft)',
                    borderRadius: 8,
                    padding: '8px 9px',
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}
                  >
                    <Icon name="data_array" size={15} color="var(--ac-tx)" />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ac-tx)' }}>
                      Любое из условий группы
                    </span>
                    <button
                      type="button"
                      className="btn btn--sm"
                      style={{
                        height: 20,
                        padding: '0 7px',
                        background: 'var(--surface)',
                        border: '1px solid var(--ac-soft2)',
                        color: 'var(--ac-tx)',
                        fontSize: 10.5,
                        fontWeight: 600,
                      }}
                      onClick={() => setGroupJoin(groupJoin === 'OR' ? 'AND' : 'OR')}
                    >
                      {groupJoin}
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon-quiet spacer"
                      style={{ width: 20, height: 20 }}
                      aria-label="Удалить группу"
                      onClick={() => setHasGroup(false)}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {GROUP_CONDITIONS.map((gc) => (
                      <div
                        key={gc.field}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '38px 142px 120px minmax(0,1fr)',
                          alignItems: 'center',
                          gap: 7,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--ac-tx)',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                          }}
                        >
                          {gc.join}
                        </span>
                        <button
                          type="button"
                          className="cond__pick"
                          style={{ height: 28, background: 'var(--surface)' }}
                        >
                          <Icon name={gc.icon} size={15} color="var(--tx3)" />
                          <span style={{ flex: 1, textAlign: 'left' }}>{gc.field}</span>
                          <Icon name="expand_more" size={15} color="var(--tx3)" />
                        </button>
                        <button
                          type="button"
                          className="cond__pick"
                          style={{
                            height: 28,
                            background: 'var(--surface)',
                            justifyContent: 'space-between',
                            color: 'var(--tx2)',
                          }}
                        >
                          {gc.op}
                          <Icon name="expand_more" size={15} color="var(--tx3)" />
                        </button>
                        <div
                          className="cond__values"
                          style={{ minHeight: 28, background: 'var(--surface)' }}
                        >
                          <span
                            className="badge"
                            style={{ background: gc.vbg, color: gc.vfg, height: 20 }}
                          >
                            {gc.value}
                            <Icon name="close" size={13} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
              <button
                type="button"
                className="btn btn--dashed"
                onClick={() =>
                  setConditions([
                    ...conditions,
                    {
                      field: 'Исполнитель',
                      op: 'равен',
                      icon: 'person',
                      values: ['currentUser()'],
                      vbg: 'var(--ac-soft)',
                      vfg: 'var(--ac-tx)',
                    },
                  ])
                }
              >
                <Icon name="add" size={15} />
                Условие
              </button>
              <button
                type="button"
                className="btn btn--dashed"
                onClick={() => setHasGroup(true)}
              >
                <Icon name="data_array" size={15} />
                Группа условий
              </button>
            </div>
          </section>
        )}

        {mode === 'query' && (
          <section className="card card--pad" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginBottom: 7 }}>
              Язык запросов Vekha
            </div>
            <div className="jql">
              <span className="k">queue</span> = <span className="s">"VEKHA"</span>{' '}
              <span className="op">AND</span> <span className="k">status</span>{' '}
              <span className="op">IN</span> (<span className="s">"In Progress"</span>,{' '}
              <span className="s">"Review"</span>)
              <br />
              <span className="op">AND</span> <span className="k">assignee</span> ={' '}
              <span className="s">currentUser()</span> <span className="op">AND</span>{' '}
              <span className="k">deadline</span> &lt;= <span className="s">endOfWeek()</span>
              <br />
              <span className="op">ORDER BY</span> <span className="k">priority</span>{' '}
              <span className="op">DESC</span>, <span className="k">deadline</span>{' '}
              <span className="op">ASC</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 9,
                fontSize: 11.5,
                color: 'var(--ok)',
              }}
            >
              <Icon name="check_circle" size={15} />
              Синтаксис корректен · 4 условия · оценка 128 мс
            </div>
          </section>
        )}

        <section className="card card--clip">
          <div className="card__head">
            <div className="card__title">Результаты</div>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
              {results.length}
            </span>
            <div className="spacer" style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => nav('/tasks')}
              >
                Открыть как список
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => nav('/board')}
              >
                Открыть как доску
              </button>
            </div>
          </div>
          {results.map((t) => (
            <div
              key={t.key}
              className="row"
              style={{
                gridTemplateColumns: '88px minmax(0,1fr) 124px 32px 26px 130px 78px',
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
              <span className="ellipsis" style={{ fontSize: 12, color: 'var(--tx2)' }}>
                {t.project}
              </span>
              <span
                className="mono"
                style={{ fontSize: 11.5, color: dueColor(t.dueState), textAlign: 'right' }}
              >
                {t.due}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
