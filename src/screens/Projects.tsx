import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, Progress } from '../components/ui'
import { PEOPLE } from '../data/catalog'
import { PROJECTS } from '../data/projects'
import type { PersonId } from '../data/types'
import { useUi } from '../store/ui'

const TEAM_PREVIEW: PersonId[] = ['AK', 'DS', 'MN', 'IV']

export function Projects() {
  const nav = useNavigate()
  const ui = useUi()

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">Проекты</div>
        <span className="page__note mono">{PROJECTS.length} активных</span>
        <button type="button" className="btn btn--primary spacer" onClick={ui.openCreateModal}>
          <Icon name="add" size={16} />
          Проект
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))',
          gap: 10,
        }}
      >
        {PROJECTS.map((p) => (
          <div
            key={p.name}
            className="card card--hover"
            style={{ padding: 13 }}
            onClick={() => nav(`/projects/${encodeURIComponent(p.name)}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: p.bg,
                  color: p.fg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11.5,
                  fontWeight: 600,
                  flex: 'none',
                }}
              >
                {p.abbr}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                  {p.queue} · лид {PEOPLE[p.lead].name.split(' ')[0]}
                </div>
              </div>
              <span
                className="badge badge--sm"
                style={{ background: p.stBg, color: p.stFg }}
              >
                {p.state}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: 'var(--tx2)',
                marginTop: 12,
              }}
            >
              <span>
                {p.done} из {p.total} задач
              </span>
              <span className="mono">{p.pct}</span>
            </div>
            <Progress
              pct={p.pct}
              color={p.fg}
              style={{ marginTop: 6, height: 5, borderRadius: 3 }}
            />

            <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
              <span className="av-stack">
                {TEAM_PREVIEW.map((m) => (
                  <Avatar key={m} id={m} size="base" />
                ))}
              </span>
              <span
                className="mono spacer"
                style={{ fontSize: 11, color: p.atRisk ? 'var(--dang)' : 'var(--tx2)' }}
              >
                до {p.due}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
