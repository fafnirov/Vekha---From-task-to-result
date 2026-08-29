import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { priorityStyle, statusStyle } from '../../data/catalog'
import { usePerson } from '../../store/session'
import type {
  PersonId,
  PriorityName,
  StatusCategory,
  StatusName,
} from '../../data/types'

export function Icon({
  name,
  size = 18,
  color,
  className,
  title,
}: {
  name: string
  size?: number
  color?: string
  className?: string
  title?: string
}) {
  return (
    <span
      className={className ? `ic ${className}` : 'ic'}
      style={{ fontSize: size, color }}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      {name}
    </span>
  )
}

export function Avatar({
  id,
  size = 'md',
  title,
}: {
  /** Код участника; null отрисует нейтральную заглушку «без исполнителя». */
  id: PersonId | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'base'
  title?: boolean
}) {
  const p = usePerson(id)
  const cls = size === 'base' ? 'av' : `av av--${size}`

  if (!id) {
    return (
      <span
        className={cls}
        style={{ background: 'var(--n-bg)', color: 'var(--tx3)' }}
        title={title === false ? undefined : 'Без исполнителя'}
      >
        —
      </span>
    )
  }

  return (
    <span
      className={cls}
      style={{ background: p.bg, color: p.fg }}
      title={title === false ? undefined : `${p.name} · ${p.role}`}
    >
      {p.who}
    </span>
  )
}

export function AvatarStack({
  ids,
  size = 'md',
}: {
  ids: (PersonId | null)[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  return (
    <span className="av-stack">
      {ids.map((id, i) => (
        <Avatar key={id ?? `empty-${i}`} id={id} size={size} />
      ))}
    </span>
  )
}

export function StatusBadge({
  status,
  category,
  dot = true,
  small = false,
}: {
  status: StatusName
  /** Категория нужна статусам, добавленным в настройках воркфлоу. */
  category?: StatusCategory
  dot?: boolean
  small?: boolean
}) {
  const st = statusStyle(status, category)
  return (
    <span
      className={small ? 'badge badge--sm' : 'badge'}
      style={{ background: st.bg, color: st.fg }}
    >
      {dot && <span className="badge__dot" style={{ background: st.dot }} />}
      {status}
    </span>
  )
}

export function PriorityChip({
  priority,
  small = false,
}: {
  priority: PriorityName
  small?: boolean
}) {
  const pr = priorityStyle(priority)
  return (
    <span
      className={small ? 'pr pr--sm' : 'pr'}
      style={{ background: pr.bg }}
      title={priority}
    >
      <Icon name={pr.icon} size={small ? 14 : 15} color={pr.fg} />
    </span>
  )
}

/**
 * Ключ задачи. Самая копируемая строка в трекере — её несут в чат,
 * в коммит и в созвон, поэтому клик копирует её в буфер.
 */
export function TaskKey({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const value = String(children ?? '')

  async function copy(e: React.MouseEvent) {
    // Ключ живёт внутри кликабельной строки — переход открыл бы задачу.
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 900)
    } catch {
      /* Буфер может быть недоступен — тогда просто ничего не происходит. */
    }
  }

  return (
    <button
      type="button"
      className={copied ? 'key key--copied' : 'key'}
      onClick={(e) => void copy(e)}
      title={copied ? 'Скопировано' : `Скопировать ${value}`}
    >
      {copied ? 'скопировано' : children}
    </button>
  )
}

export function Tag({
  children,
  outline = false,
}: {
  children: ReactNode
  outline?: boolean
}) {
  return <span className={outline ? 'tag tag--outline' : 'tag'}>{children}</span>
}

export function Progress({
  pct,
  color = 'var(--ac)',
  variant = 'base',
  style,
}: {
  pct: string
  color?: string
  variant?: 'thin' | 'base' | 'thick'
  style?: CSSProperties
}) {
  const cls =
    variant === 'thin' ? 'bar bar--thin' : variant === 'thick' ? 'bar bar--thick' : 'bar'
  return (
    <div className={cls} style={style}>
      <div className="bar__fill" style={{ width: pct, background: color }} />
    </div>
  )
}

export function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      className={on ? 'toggle toggle--on' : 'toggle'}
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
    />
  )
}

export function Checkbox({
  on,
  onClick,
  tone = 'accent',
  small = false,
  label,
}: {
  on: boolean
  onClick: (e: React.MouseEvent) => void
  tone?: 'accent' | 'ok'
  small?: boolean
  label: string
}) {
  const cls = [
    'cb',
    small && 'cb--sm',
    tone === 'ok' && 'cb--ok',
    on && 'cb--on',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      role="checkbox"
      aria-checked={on}
      aria-label={label}
    >
      <Icon name="check" size={small ? 12 : 12} />
    </button>
  )
}

export interface SegOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly SegOption<T>[]
  value: T
  onChange: (v: T) => void
  style?: CSSProperties
}) {
  return (
    <div className="seg" style={style} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'seg__item seg__item--on' : 'seg__item'}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  height = 34,
}: {
  options: readonly { value: T; label: string; count?: string }[]
  value: T
  onChange: (v: T) => void
  height?: number
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'tab tab--on' : 'tab'}
          style={{ height }}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="tab__count">{o.count}</span>}
          <span className="tab__underline" />
        </button>
      ))}
    </div>
  )
}

export function Empty({
  icon = 'search_off',
  title,
  text,
  action,
}: {
  icon?: string
  title: string
  text: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon name={icon} size={22} color="var(--tx3)" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div
        className="pretty"
        style={{
          fontSize: 13,
          color: 'var(--tx2)',
          maxWidth: 320,
          textAlign: 'center',
        }}
      >
        {text}
      </div>
      {action}
    </div>
  )
}

export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
      <div className="card__title">{children}</div>
      {right && <div className="spacer">{right}</div>}
    </div>
  )
}
