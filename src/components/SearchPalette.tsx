import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, StatusBadge } from './ui'
import { SEARCH_NAV } from '../lib/nav'
import { useSearch } from '../api/hooks'
import { useUi } from '../store/ui'

/** Задержка перед запросом: пользователь успевает дописать слово. */
function useDebounced(value: string, delay = 180): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function SearchPalette() {
  const ui = useUi()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const debounced = useDebounced(q)
  const search = useSearch(debounced)

  const tasks = search.data?.tasks ?? []
  const projects = search.data?.projects ?? []
  const queues = search.data?.queues ?? []

  const commands = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? SEARCH_NAV.filter((s) => s.label.toLowerCase().includes(needle)) : SEARCH_NAV
  }, [q])

  /** Плоский список для навигации стрелками. */
  const rows = useMemo(
    () => [
      ...tasks.map((t) => ({ kind: 'task' as const, to: `/tasks/${t.key}`, data: t })),
      ...projects.map((p) => ({
        kind: 'project' as const,
        to: `/projects/${encodeURIComponent(p.name)}`,
        data: p,
      })),
      ...queues.map((qq) => ({ kind: 'queue' as const, to: `/tasks?queue=${qq.key}`, data: qq })),
      ...commands.map((c) => ({ kind: 'command' as const, to: c.to, data: c })),
    ],
    [tasks, projects, queues, commands],
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setCursor(0)
  }, [debounced])

  const go = (index: number) => {
    const row = rows[index]
    if (row) nav(row.to)
    ui.closeAll()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (rows.length ? (c + 1) % rows.length : 0))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (rows.length ? (c - 1 + rows.length) % rows.length : 0))
    }
    if (e.key === 'Enter' && rows.length) {
      e.preventDefault()
      go(cursor)
    }
  }

  let index = -1
  const nextIndex = () => (index += 1)

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
        <div className="palette__input">
          <Icon name="search" size={19} color="var(--tx3)" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск по задачам, проектам, людям…"
          />
          {search.isFetching && <Icon name="progress_activity" size={16} color="var(--tx3)" />}
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

        <div className="palette__body">
          <div className="vk-eyebrow" style={{ padding: '8px 8px 5px' }}>
            Задачи
          </div>
          {tasks.length === 0 && (
            <div className="palette__empty">
              {debounced ? 'Ничего не найдено' : 'Начните вводить ключ или слово из заголовка'}
            </div>
          )}
          {tasks.map((t) => {
            const i = nextIndex()
            return (
              <button
                key={t.key}
                type="button"
                className="menu__item"
                style={{ height: 34, background: i === cursor ? 'var(--ac-soft)' : 'transparent' }}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(i)}
              >
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--tx3)', width: 78 }}>
                  {t.key}
                </span>
                <span className="ellipsis" style={{ flex: 1, fontSize: 12.5 }}>
                  {t.title}
                </span>
                <StatusBadge status={t.status} category={t.statusCategory} dot={false} small />
              </button>
            )
          })}

          {(projects.length > 0 || queues.length > 0) && (
            <>
              <div className="vk-eyebrow" style={{ padding: '10px 8px 5px' }}>
                Проекты и очереди
              </div>
              {projects.map((p) => {
                const i = nextIndex()
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="menu__item"
                    style={{ height: 32, background: i === cursor ? 'var(--ac-soft)' : 'transparent' }}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(i)}
                  >
                    <Icon name="folder_open" size={17} color="var(--tx2)" />
                    <span style={{ flex: 1, fontSize: 12.5 }}>{p.name}</span>
                  </button>
                )
              })}
              {queues.map((qq) => {
                const i = nextIndex()
                return (
                  <button
                    key={qq.id}
                    type="button"
                    className="menu__item"
                    style={{ height: 32, background: i === cursor ? 'var(--ac-soft)' : 'transparent' }}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(i)}
                  >
                    <Icon name="layers" size={17} color="var(--tx2)" />
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--ac-tx)', width: 78 }}>
                      {qq.key}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5 }}>{qq.name}</span>
                  </button>
                )
              })}
            </>
          )}

          <div className="vk-eyebrow" style={{ padding: '10px 8px 5px' }}>
            Команды и переходы
          </div>
          {commands.map((s) => {
            const i = nextIndex()
            return (
              <button
                key={s.label}
                type="button"
                className="menu__item"
                style={{ height: 32, background: i === cursor ? 'var(--ac-soft)' : 'transparent' }}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(i)}
              >
                <Icon name={s.icon} size={17} color="var(--tx2)" />
                <span style={{ flex: 1, fontSize: 12.5 }}>{s.label}</span>
                <span className="menu__kb">{s.kb}</span>
              </button>
            )
          })}
        </div>

        <div className="palette__foot">
          <span>↑↓ навигация</span>
          <span>↵ открыть</span>
          <span>Esc закрыть</span>
        </div>
      </div>
    </div>
  )
}
