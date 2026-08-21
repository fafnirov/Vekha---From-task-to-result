import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './ui'
import { CRUMBS, CREATE_ITEMS } from '../lib/nav'
import { NOTIFICATIONS } from '../data/feed'
import { ORG, PEOPLE } from '../data/catalog'
import { findTask } from '../data/tasks'
import { useUi } from '../store/ui'
import { useApp } from '../store/app'

function useCrumbs(): { label: string; to?: string }[] {
  const { pathname } = useLocation()
  const trail: { label: string; to?: string }[] = [{ label: ORG.name, to: '/' }]

  if (pathname.startsWith('/tasks/')) {
    const key = decodeURIComponent(pathname.slice('/tasks/'.length))
    trail.push({ label: 'Задачи', to: '/tasks' })
    trail.push({ label: findTask(key).key })
    return trail
  }
  if (pathname.startsWith('/projects/')) {
    const name = decodeURIComponent(pathname.slice('/projects/'.length))
    trail.push({ label: 'Проекты', to: '/projects' })
    trail.push({ label: name })
    return trail
  }
  trail.push({ label: CRUMBS[pathname] ?? 'Главная' })
  return trail
}

export function TopBar() {
  const nav = useNavigate()
  const crumbs = useCrumbs()
  const ui = useUi()
  const { toast } = useApp()
  const unread = NOTIFICATIONS.filter((n) => n.unread).length

  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="Хлебные крошки">
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} style={{ display: 'contents' }}>
            <button type="button" onClick={() => c.to && nav(c.to)}>
              {c.label}
            </button>
            {i < crumbs.length - 1 && <Icon name="chevron_right" size={14} />}
          </span>
        ))}
      </nav>

      <button type="button" className="searchbtn" onClick={ui.openSearch}>
        <Icon name="search" size={16} />
        <span>Поиск задач, проектов, людей</span>
        <span className="kbd">⌘K</span>
      </button>

      <div className="topbar__tools">
        <button
          type="button"
          className="topbar__create"
          onClick={ui.toggleCreateMenu}
        >
          <Icon name="add" size={17} />
          Создать
        </button>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="topbar__btn"
            title="Уведомления"
            onClick={ui.toggleNotif}
          >
            <Icon name="notifications" size={17} />
          </button>
          {unread > 0 && <span className="dot-badge" />}
        </div>

        <button
          type="button"
          className="topbar__btn"
          title="Помощь"
          onClick={() =>
            toast('Горячие клавиши', '⌘K — поиск, C — создать, Esc — закрыть', 'info')
          }
        >
          <Icon name="help" size={17} />
        </button>
      </div>

      {ui.createOpen && (
        <div className="menu" style={{ top: 46, right: 96, width: 238 }}>
          {CREATE_ITEMS.map((ci) => (
            <button
              key={ci.label}
              type="button"
              className="menu__item"
              onClick={() => {
                if (ci.label === 'Задача') ui.openCreateModal()
                else {
                  ui.closeAll()
                  toast('Создание', `${ci.label} — форма откроется в диалоге`, 'info')
                }
              }}
            >
              <Icon name={ci.icon} size={17} color="var(--tx2)" />
              <span style={{ flex: 1, fontSize: 12.5 }}>{ci.label}</span>
              <span className="menu__kb">{ci.kb}</span>
            </button>
          ))}
        </div>
      )}

      {ui.notifOpen && (
        <div
          className="menu"
          style={{ top: 46, right: 52, width: 330, padding: 0, overflow: 'hidden' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '9px 12px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Уведомления</div>
            <button
              type="button"
              className="btn btn--link spacer"
              style={{ fontSize: 11.5 }}
              onClick={() => {
                ui.closeAll()
                toast('Уведомления', 'Все отмечены прочитанными', 'ok')
              }}
            >
              Прочитать все
            </button>
          </div>
          {NOTIFICATIONS.map((n) => {
            const p = PEOPLE[n.who]
            return (
              <Link
                key={n.key + n.time}
                to={`/tasks/${n.key}`}
                onClick={ui.closeAll}
                style={{
                  display: 'flex',
                  gap: 9,
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border)',
                  background: n.unread ? 'var(--ac-soft)' : 'transparent',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <span className="av" style={{ background: p.bg, color: p.fg }}>
                  {p.who}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--tx)' }}>
                    {n.text}
                  </span>
                  <span
                    className="mono"
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: 'var(--tx3)',
                      marginTop: 2,
                    }}
                  >
                    {n.key} · {n.time}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}
