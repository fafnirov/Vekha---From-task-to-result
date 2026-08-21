import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, StatusBadge } from './ui'
import { TASKS } from '../data/tasks'
import { SEARCH_NAV } from '../lib/nav'
import { useUi } from '../store/ui'
import { useApp } from '../store/app'

export function SearchPalette() {
  const ui = useUi()
  const nav = useNavigate()
  const { statusOf } = useApp()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const tasks = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? TASKS.filter((t) =>
          `${t.key} ${t.title} ${t.project}`.toLowerCase().includes(needle),
        )
      : TASKS.slice(0, 5)
    return list.slice(0, 6)
  }, [q])

  const commands = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle
      ? SEARCH_NAV.filter((s) => s.label.toLowerCase().includes(needle))
      : SEARCH_NAV
  }, [q])

  const total = tasks.length + commands.length

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setCursor(0)
  }, [q])

  const go = (index: number) => {
    if (index < tasks.length) {
      nav(`/tasks/${tasks[index].key}`)
    } else {
      const cmd = commands[index - tasks.length]
      if (cmd) nav(cmd.to)
    }
    ui.closeAll()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (total ? (c + 1) % total : 0))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (total ? (c - 1 + total) % total : 0))
    }
    if (e.key === 'Enter' && total) {
      e.preventDefault()
      go(cursor)
    }
  }

  return (
    <div
      className="scrim"
      style={{ alignItems: 'flex-start', paddingTop: '11vh' }}
      onClick={ui.closeAll}
    >
      <div
        className="modal"
        style={{ width: 640, maxWidth: '92vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Поиск"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon name="search" size={19} color="var(--tx3)" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск по задачам, проектам, людям…"
            style={{
              flex: 1,
              border: 0,
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              color: 'var(--tx)',
            }}
          />
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            onClick={() => {
              nav('/filters')
              ui.closeAll()
            }}
          >
            Расширенный поиск
          </button>
        </div>

        <div style={{ maxHeight: '56vh', overflow: 'auto', padding: 6 }}>
          <div className="vk-eyebrow" style={{ padding: '8px 8px 5px' }}>
            Задачи
          </div>
          {tasks.length === 0 && (
            <div style={{ padding: '6px 8px 10px', fontSize: 12.5, color: 'var(--tx3)' }}>
              Ничего не найдено
            </div>
          )}
          {tasks.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className="menu__item"
              style={{
                height: 34,
                background: i === cursor ? 'var(--ac-soft)' : 'transparent',
              }}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(i)}
            >
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--tx3)', width: 72 }}>
                {t.key}
              </span>
              <span className="ellipsis" style={{ flex: 1, fontSize: 12.5 }}>
                {t.title}
              </span>
              <StatusBadge status={statusOf(t.key)} dot={false} small />
            </button>
          ))}

          <div className="vk-eyebrow" style={{ padding: '10px 8px 5px' }}>
            Команды и переходы
          </div>
          {commands.map((s, i) => {
            const index = tasks.length + i
            return (
              <button
                key={s.label}
                type="button"
                className="menu__item"
                style={{
                  height: 32,
                  background: index === cursor ? 'var(--ac-soft)' : 'transparent',
                }}
                onMouseEnter={() => setCursor(index)}
                onClick={() => go(index)}
              >
                <Icon name={s.icon} size={17} color="var(--tx2)" />
                <span style={{ flex: 1, fontSize: 12.5 }}>{s.label}</span>
                <span className="menu__kb">{s.kb}</span>
              </button>
            )
          })}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
            padding: '9px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface2)',
            fontSize: 11,
            color: 'var(--tx3)',
          }}
        >
          <span>↑↓ навигация</span>
          <span>↵ открыть</span>
          <span>Esc закрыть</span>
        </div>
      </div>
    </div>
  )
}
