import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './ui'
import { Tooltip } from './Tooltip'
import { NAV_ADMIN, NAV_MAIN, type NavItem } from '../lib/nav'
import { useProjects, useQueues, useTasks } from '../api/hooks'
import { useSession } from '../store/session'
import { useApp } from '../store/app'

function isActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/'
  return pathname.startsWith(item.to) || (item.also ?? []).some((p) => pathname.startsWith(p))
}

export function Sidebar() {
  const { navCollapsed, toggleNav, theme, toggleTheme, toast, toastError, mobileNav, closeMobileNav } =
    useApp()
  const { me, org, logout, can } = useSession()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const expanded = !navCollapsed

  /* Счётчики берутся из тех же запросов, что и экраны, поэтому не расходятся. */
  const queues = useQueues()
  const projects = useProjects()
  const tasks = useTasks({ perPage: 1, category: 'todo,inprogress,blocked' })

  const counts: Record<NonNullable<NavItem['count']>, number | undefined> = {
    tasks: tasks.data?.total,
    queues: queues.data?.length,
    projects: projects.data?.length,
  }

  const renderItem = (item: NavItem) => {
    const on = isActive(item, pathname)
    const count = item.count ? counts[item.count] : undefined
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={on ? 'nav__item nav__item--on' : 'nav__item'}
        title={navCollapsed ? item.label : undefined}
        onClick={closeMobileNav}
      >
        <Icon name={item.icon} size={17} />
        {expanded && <span className="nav__label">{item.label}</span>}
        {expanded && count !== undefined && <span className="nav__count">{count}</span>}
      </NavLink>
    )
  }

  async function signOut() {
    try {
      await logout()
      navigate('/')
    } catch (err) {
      toastError(err, 'Не удалось выйти')
    }
  }

  return (
    <aside className={mobileNav ? 'sidebar sidebar--open' : 'sidebar'}>
      <div className="sidebar__brand">
        <div className="sidebar__mark">
          <i />
        </div>
        {expanded && <div className="sidebar__name">Vekha</div>}
        {expanded && <div className="sidebar__ver">{org.version}</div>}
        <Tooltip label={navCollapsed ? 'Развернуть меню' : 'Свернуть меню'} side="right">
          <button
            type="button"
            className="sidebar__collapse"
            onClick={toggleNav}
            style={{ marginLeft: expanded ? 0 : 'auto' }}
            aria-label={navCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            <Icon name={navCollapsed ? 'left_panel_open' : 'left_panel_close'} size={17} />
          </button>
        </Tooltip>
      </div>

      <button
        type="button"
        className="org"
        onClick={() =>
          can('workflow.manage')
            ? navigate('/workflow?tab=org')
            : toast('Рабочее пространство', `${org.name} · ${org.unit}`, 'info')
        }
        title={can('workflow.manage') ? 'Настройки пространства' : org.name}
      >
        <span className="org__mark">{org.mark}</span>
        {expanded && (
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="org__name ellipsis" style={{ display: 'block' }}>
              {org.name}
            </span>
            <span className="org__sub">{org.unit}</span>
          </span>
        )}
        {expanded && <Icon name="unfold_more" size={16} color="var(--tx3)" />}
      </button>

      <nav className="nav">
        {expanded && <div className="nav__group">Работа</div>}
        {NAV_MAIN.map(renderItem)}
        {expanded ? (
          <div className="nav__group nav__group--tight">Управление</div>
        ) : (
          <div className="nav__rule" />
        )}
        {NAV_ADMIN.map(renderItem)}
      </nav>

      <div className="sidebar__foot" style={{ position: 'relative' }}>
        <button
          type="button"
          className="av av--lg"
          style={{ background: me?.bg, color: me?.fg, border: 0, cursor: 'pointer' }}
          onClick={() => setMenuOpen((v) => !v)}
          title={me?.name}
        >
          {me?.who}
        </button>
        {expanded && (
          <button
            type="button"
            className="sidebar__me"
            onClick={() => setMenuOpen((v) => !v)}
            style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0 }}
          >
            <b>{me?.name}</b>
            <span>{me?.role}</span>
          </button>
        )}
        <Tooltip
          label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          hint="Выбор запоминается"
          side="top"
        >
          <button
            type="button"
            className="sidebar__tool"
            aria-label="Сменить тему"
            onClick={toggleTheme}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={16} />
          </button>
        </Tooltip>

        {menuOpen && (
          <>
            <div className="scrim scrim--bare" onClick={() => setMenuOpen(false)} />
            <div className="menu" style={{ bottom: 52, left: 10, width: 200 }}>
              <div className="menu__head">
                <b>{me?.name}</b>
                <span>{me?.email}</span>
              </div>
              <button
                type="button"
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/profile')
                }}
              >
                <Icon name="account_circle" size={17} color="var(--tx2)" />
                <span style={{ flex: 1, fontSize: 13 }}>Профиль и пароль</span>
              </button>
              {can('people.manage') && (
                <button
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/workflow?tab=people')
                  }}
                >
                  <Icon name="manage_accounts" size={17} color="var(--tx2)" />
                  <span style={{ flex: 1, fontSize: 13 }}>Участники и права</span>
                </button>
              )}
              <button
                type="button"
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false)
                  void signOut()
                }}
              >
                <Icon name="logout" size={17} color="var(--dang)" />
                <span style={{ flex: 1, fontSize: 13 }}>Выйти</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
