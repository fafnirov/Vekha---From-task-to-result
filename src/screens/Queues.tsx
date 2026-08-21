import { useNavigate } from 'react-router-dom'
import { Avatar, Icon } from '../components/ui'
import { PEOPLE } from '../data/catalog'
import { QUEUES } from '../data/workspace'

const GRID = '74px minmax(0,1fr) 150px 92px 128px 118px 30px'

export function Queues() {
  const nav = useNavigate()

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">Очереди</div>
        <span className="page__note">
          контейнеры задач с собственным воркфлоу и правами
        </span>
        <button
          type="button"
          className="btn btn--primary spacer"
          onClick={() => nav('/workflow')}
        >
          <Icon name="add" size={16} />
          Очередь
        </button>
      </div>

      <div className="card card--clip">
        <div className="thead" style={{ gridTemplateColumns: GRID, gap: 10, padding: '0 13px' }}>
          <span>Ключ</span>
          <span>Название</span>
          <span>Владелец</span>
          <span style={{ textAlign: 'right' }}>Задач</span>
          <span>Воркфлоу</span>
          <span>Доступ</span>
          <span />
        </div>
        {QUEUES.map((q) => (
          <div
            key={q.key}
            className="row"
            style={{ gridTemplateColumns: GRID, gap: 10 }}
            onClick={() => nav('/workflow')}
          >
            <span className="key" style={{ fontWeight: 500 }}>
              {q.key}
            </span>
            <span style={{ fontSize: 12.5 }}>{q.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <Avatar id={q.owner} size="xs" title={false} />
              <span className="ellipsis" style={{ fontSize: 12, color: 'var(--tx2)' }}>
                {PEOPLE[q.owner].name}
              </span>
            </span>
            <span
              className="mono"
              style={{ fontSize: 12, color: 'var(--tx2)', textAlign: 'right' }}
            >
              {q.n}
            </span>
            <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{q.wf}</span>
            <span className="badge" style={{ background: q.accBg, color: q.accFg, height: 20 }}>
              {q.access}
            </span>
            <Icon name="chevron_right" size={16} color="var(--tx3)" />
          </div>
        ))}
      </div>
    </div>
  )
}
