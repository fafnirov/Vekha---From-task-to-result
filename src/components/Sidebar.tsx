import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from './ui'
import { NAV_ADMIN, NAV_MAIN, type NavItem } from '../lib/nav'
import { CURRENT_USER, ORG, PEOPLE } from '../data/catalog'
import { useApp } from '../store/app'

function isActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/'
  return (
    pathname.startsWith(item.to) ||
    (item.also ?? []).some((p) => pathname.startsWith(p))
  )
}

export function Sidebar() {
  const { navCollapsed, toggleNav, theme, toggleTheme, toast } = useApp()
  const { pathname } = useLocation()
  const expanded = !navCollapsed
  const me = PEOPLE[CURRENT_USER]

  const renderItem = (item: NavItem) => {
    const on = isActive(item, pathname)
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={on ? 'nav__item nav__item--on' : 'nav__item'}
        title={navCollapsed ? item.label : undefined}
      >
        <Icon name={item.icon} size={17} />
        {expanded && <span className="nav__label">{item.label}</span>}
        {expanded && item.count !== undefined && (
          <span className="nav__count">{item.count}</span>
        )}
      </NavLink>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__mark">
          <i />
        </div>
        {expanded && <div className="sidebar__name">Vekha</div>}
        {expanded && <div className="sidebar__ver">{ORG.version}</div>}
        <button
          type="button"
          className="sidebar__collapse"
          onClick={toggleNav}
          style={{ marginLeft: expanded ? 0 : 'auto' }}
          title={navCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <Icon name={navCollapsed ? 'left_panel_open' : 'left_panel_close'} size={17} />
        </button>
      </div>

      <button
        type="button"
        className="org"
        onClick={() => toast('Рабочее пространство', ORG.name, 'info')}
      >
        <span className="org__mark">{ORG.mark}</span>
        {expanded && (
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="org__name ellipsis" style={{ display: 'block' }}>
              {ORG.name}
            </span>
            <span className="org__sub">{ORG.unit}</span>
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

      <div className="sidebar__foot">
        <span className="av av--lg" style={{ background: me.bg, color: me.fg }}>
          {me.who}
        </span>
        {expanded && (
          <div className="sidebar__me">
            <b>{me.name}</b>
            <span>{me.role}</span>
          </div>
        )}
        {expanded && (
          <button
            type="button"
            className="sidebar__tool"
            title="Дизайн-система"
            onClick={() =>
              toast(
                'Дизайн-система Vekha',
                'Токены, компоненты и состояния — в styles/',
                'info',
              )
            }
          >
            <Icon name="palette" size={16} />
          </button>
        )}
        <button
          type="button"
          className="sidebar__tool"
          title="Сменить тему"
          onClick={toggleTheme}
        >
          <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={16} />
        </button>
      </div>
    </aside>
  )
}
