import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Icon } from './ui'
import { Tooltip } from './Tooltip'
import { CRUMBS } from '../lib/nav'
import { api } from '../api/client'
import { useInvalidate, useNotifications } from '../api/hooks'
import { useSession } from '../store/session'
import { useUi } from '../store/ui'
import { useApp } from '../store/app'

function useCrumbs(orgName: string): { label: string; to?: string }[] {
  const { pathname } = useLocation()
  const trail: { label: string; to?: string }[] = [{ label: orgName, to: '/' }]

  if (pathname.startsWith('/tasks/')) {
    trail.push({ label: 'Задачи', to: '/tasks' })
    trail.push({ label: decodeURIComponent(pathname.slice('/tasks/'.length)) })
    return trail
  }
  if (pathname.startsWith('/projects/')) {
    trail.push({ label: 'Проекты', to: '/projects' })
    trail.push({ label: decodeURIComponent(pathname.slice('/projects/'.length)) })
    return trail
  }
  trail.push({ label: CRUMBS[pathname] ?? 'Главная' })
  return trail
}

export function TopBar() {
  const nav = useNavigate()
  const ui = useUi()
  const { org, can } = useSession()
  const { toast, toastError, toggleMobileNav } = useApp()
  const crumbs = useCrumbs(org.name)
  const invalidate = useInvalidate()

  const notifications = useNotifications()
  const items = notifications.data?.items ?? []
  const unread = notifications.data?.unread ?? 0

  async function readAll() {
    try {
      await api.post('/api/notifications/read')
      invalidate(['notifications'])
      toast('Уведомления', 'Все отмечены прочитанными', 'ok')
    } catch (err) {
      toastError(err)
    }
    ui.closeAll()
  }

  const createItems = [
    { label: 'Задача', icon: 'add_task', kb: 'C', action: () => ui.openCreateModal() },
    {
      label: 'Проект',
      icon: 'folder_open',
      kb: 'P',
      action: () => {
        ui.closeAll()
        nav('/projects?new=1')
      },
      need: 'sprint.manage',
    },
    {
      label: 'Очередь',
      icon: 'layers',
      kb: 'Q',
      action: () => {
        ui.closeAll()
        nav('/queues?new=1')
      },
      need: 'workflow.manage',
    },
    {
      label: 'Правило автоматизации',
      icon: 'bolt',
      kb: 'A',
      action: () => {
        ui.closeAll()
        nav('/workflow?tab=rules&new=1')
      },
      need: 'workflow.manage',
    },
  ].filter((i) => !i.need || can(i.need))

  return (
    <header className="topbar">
      <Tooltip label="Разделы" side="bottom">
          <button
            type="button"
            className="topbar__burger"
            onClick={toggleMobileNav}
            aria-label="Меню"
          >
            <Icon name="menu" size={19} />
          </button>
        </Tooltip>

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
        {/* Роли, которой нечего создавать, кнопка открывала пустое меню. */}
        {createItems.length > 0 && (
          <button type="button" className="topbar__create" onClick={ui.toggleCreateMenu}>
            <Icon name="add" size={17} />
            Создать
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <Tooltip
            label="Уведомления"
            hint={unread > 0 ? `${unread} непрочитанных` : 'Всё прочитано'}
            side="bottom"
          >
            <button type="button" className="topbar__btn" onClick={ui.toggleNotif}>
              <Icon name="notifications" size={17} />
            </button>
          </Tooltip>
          {unread > 0 && <span className="dot-badge" />}
        </div>

        <Tooltip label="Горячие клавиши" hint="⌘K — поиск, C — создать, Esc — закрыть" side="bottom">
          <button
            type="button"
            className="topbar__btn"
            aria-label="Помощь"
            onClick={() =>
              toast('Горячие клавиши', '⌘K — поиск, C — создать, Esc — закрыть', 'info')
            }
          >
            <Icon name="help" size={17} />
          </button>
        </Tooltip>
      </div>

      {ui.createOpen && (
        <>
          <div className="scrim scrim--bare" onClick={ui.closeAll} />
          <div className="menu" style={{ top: 46, right: 96, width: 238 }}>
            {createItems.map((ci) => (
              <button key={ci.label} type="button" className="menu__item" onClick={ci.action}>
                <Icon name={ci.icon} size={17} color="var(--tx2)" />
                <span style={{ flex: 1, fontSize: 13 }}>{ci.label}</span>
                <span className="menu__kb">{ci.kb}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {ui.notifOpen && (
        <>
          <div className="scrim scrim--bare" onClick={ui.closeAll} />
          <div
            className="menu"
            style={{ top: 46, right: 52, width: 340, padding: 0, overflow: 'hidden' }}
          >
            <div className="notif__head">
              <div style={{ fontSize: 13, fontWeight: 600 }}>Уведомления</div>
              {unread > 0 && <span className="count-pill">{unread}</span>}
              <button
                type="button"
                className="btn btn--link spacer"
                style={{ fontSize: 12 }}
                onClick={() => void readAll()}
              >
                Прочитать все
              </button>
            </div>

            <div className="notif__list">
              {items.length === 0 && <div className="notif__empty">Пока ничего нового</div>}
              {items.slice(0, 12).map((n) => (
                <Link
                  key={n.id}
                  to={n.key ? `/tasks/${n.key}` : '/'}
                  onClick={() => {
                    // Прочитанным считается открытое, а не всё разом.
                    if (n.unread) {
                      void api
                        .post('/api/notifications/read', { id: n.id })
                        .then(() => invalidate(['notifications']))
                        .catch(() => undefined)
                    }
                    ui.closeAll()
                  }}
                  className={n.unread ? 'notif notif--unread' : 'notif'}
                >
                  <Avatar id={n.who} size="base" title={false} />
                  <span style={{ minWidth: 0 }}>
                    <span className="notif__text">{n.text}</span>
                    <span className="notif__meta mono">
                      {n.key ? `${n.key} · ` : ''}
                      {n.time}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </header>
  )
}
