import { Avatar } from '../components/ui'
import { PEOPLE } from '../data/catalog'
import { TEAMS } from '../data/workspace'

export function Teams() {
  const headcount = new Set(TEAMS.flatMap((t) => t.members.map((m) => m.id))).size

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">Команды</div>
        <span className="page__note">
          {TEAMS.length} команды · {headcount} участников
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))',
          gap: 10,
        }}
      >
        {TEAMS.map((tm) => (
          <div key={tm.name} className="card card--clip card--hover" style={{ transform: 'none' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '12px 13px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: tm.bg,
                  color: tm.fg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {tm.abbr}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{tm.name}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{tm.note}</div>
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--tx2)' }}>
                {tm.load}
              </span>
            </div>
            {tm.members.map((m) => (
              <div
                key={m.id}
                className="row row--static"
                style={{
                  gridTemplateColumns: '24px minmax(0,1fr) 92px 40px',
                  height: 34,
                }}
              >
                <Avatar id={m.id} size="md" title={false} />
                <span className="ellipsis" style={{ fontSize: 12 }}>
                  {PEOPLE[m.id].name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{PEOPLE[m.id].role}</span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: 'var(--tx2)', textAlign: 'right' }}
                >
                  {m.tasks}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
