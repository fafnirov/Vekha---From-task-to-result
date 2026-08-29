import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Empty, Icon, StatusBadge, TaskKey } from '../components/ui'
import { dueColor } from '../data/catalog'
import { api } from '../api/client'
import { useApiMutation, useFilterFields, useFilters, useTasks } from '../api/hooks'
import { useApp } from '../store/app'

/**
 * Конструктор фильтров. Условия собираются мышью, но итог — всегда строка
 * запроса: её видно, можно править руками и сохранять как фильтр.
 */

interface Condition {
  field: string
  op: string
  value: string
}

const OPS = [
  { key: '=', label: 'равно' },
  { key: '!=', label: 'не равно' },
  { key: 'in', label: 'один из' },
  { key: '<=', label: 'не позже' },
  { key: '>=', label: 'не раньше' },
  { key: '~', label: 'содержит' },
]

function buildQuery(conditions: Condition[], join: 'AND' | 'OR'): string {
  return conditions
    .filter((c) => c.field && c.value)
    .map((c) => {
      const value = c.value.includes(' ') && !c.value.endsWith(')') ? `"${c.value}"` : c.value
      return c.op === 'in' ? `${c.field} in (${c.value})` : `${c.field} ${c.op} ${value}`
    })
    .join(` ${join} `)
}

export function Filters() {
  const nav = useNavigate()
  const { toast, toastError } = useApp()

  const catalog = useFilterFields()
  const library = useFilters()

  const [conditions, setConditions] = useState<Condition[]>([
    { field: 'assignee', op: '=', value: 'currentUser()' },
    { field: 'category', op: '!=', value: 'done' },
  ])
  const [join, setJoin] = useState<'AND' | 'OR'>('AND')
  const [manual, setManual] = useState('')
  const [edited, setEdited] = useState(false)
  const [check, setCheck] = useState<{ ok: boolean; n?: number; error?: string } | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

  const built = useMemo(() => buildQuery(conditions, join), [conditions, join])
  const query = edited ? manual : built

  useEffect(() => {
    if (!edited) setManual(built)
  }, [built, edited])

  /* Проверка запроса на сервере: она же считает количество попаданий. */
  useEffect(() => {
    if (!query.trim()) {
      setCheck(null)
      return
    }
    const timer = window.setTimeout(() => {
      void api
        .post<{ ok: boolean; n?: number; error?: string }>('/api/filters/validate', { query })
        .then(setCheck)
        .catch(() => setCheck({ ok: false, error: 'Не удалось проверить запрос' }))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const results = useTasks({ q: check?.ok ? query : undefined, perPage: 25 }, { enabled: Boolean(check?.ok) })

  const saveFilter = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/filters', body),
    ['filters'],
  )
  const dropFilter = useApiMutation<string, unknown>((id) => api.del(`/api/filters/${id}`), ['filters'])
  const toggleFavorite = useApiMutation<{ id: string; favorite: boolean }, unknown>(
    ({ id, favorite }) => api.patch(`/api/filters/${id}`, { favorite }),
    ['filters'],
  )

  function applyFilter(q: string) {
    setEdited(true)
    setManual(q)
  }

  const fields = catalog.data?.fields ?? []

  return (
    <div className="split" style={{ gridTemplateColumns: '250px minmax(0,1fr)', minHeight: '100%', gap: 0 }}>
      {/* ── Библиотека фильтров ────────────────────────────────────────── */}
      <aside className="filter-side">
        <div className="vk-eyebrow" style={{ padding: '4px 4px 8px' }}>
          Избранные
        </div>
        {(library.data?.favorites ?? []).map((f) => (
          <FilterItem
            key={f.id}
            filter={f}
            onPick={() => applyFilter(f.query)}
            onStar={() => void toggleFavorite.mutateAsync({ id: f.id, favorite: false }).catch(toastError)}
            onDrop={f.mine ? () => void dropFilter.mutateAsync(f.id).catch(toastError) : undefined}
          />
        ))}

        <div className="vk-eyebrow" style={{ padding: '12px 4px 8px' }}>
          Мои фильтры
        </div>
        {(library.data?.saved ?? []).length === 0 && (
          <div className="filter-side__none">Сохранённых фильтров нет</div>
        )}
        {(library.data?.saved ?? []).map((f) => (
          <FilterItem
            key={f.id}
            filter={f}
            onPick={() => applyFilter(f.query)}
            onStar={() => void toggleFavorite.mutateAsync({ id: f.id, favorite: true }).catch(toastError)}
            onDrop={() => void dropFilter.mutateAsync(f.id).catch(toastError)}
          />
        ))}

        <div className="vk-eyebrow" style={{ padding: '12px 4px 8px' }}>
          Командные
        </div>
        {(library.data?.team ?? []).length === 0 && (
          <div className="filter-side__none">Никто не делился фильтрами</div>
        )}
        {(library.data?.team ?? []).map((f) => (
          <FilterItem key={f.id} filter={f} onPick={() => applyFilter(f.query)} />
        ))}
      </aside>

      {/* ── Конструктор ────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 30px', minWidth: 0 }}>
        <div className="page__head" style={{ marginBottom: 12 }}>
          <div className="page__title">Расширенный поиск</div>
          <span className="page__note">условия собираются в запрос — его можно править руками</span>
        </div>

        <section className="card card--pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div className="card__title">Условия</div>
            <div className="cond__join">
              {(['AND', 'OR'] as const).map((j) => (
                <button
                  key={j}
                  type="button"
                  className={join === j ? 'seg__item seg__item--on' : 'seg__item'}
                  onClick={() => {
                    setJoin(j)
                    setEdited(false)
                  }}
                >
                  {j === 'AND' ? 'И' : 'ИЛИ'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--dashed btn--sm spacer"
              onClick={() => {
                setConditions([...conditions, { field: 'status', op: '=', value: '' }])
                setEdited(false)
              }}
            >
              <Icon name="add" size={15} />
              Условие
            </button>
          </div>

          {conditions.map((c, i) => {
            const field = fields.find((f) => f.key === c.field)
            return (
              <div key={i} className="cond">
                <Icon name={field?.icon ?? 'label'} size={16} color="var(--tx3)" />
                <select
                  className="select"
                  value={c.field}
                  onChange={(e) => {
                    const next = [...conditions]
                    next[i] = { ...c, field: e.target.value, value: '' }
                    setConditions(next)
                    setEdited(false)
                  }}
                >
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
                  className="select"
                  value={c.op}
                  onChange={(e) => {
                    const next = [...conditions]
                    next[i] = { ...c, op: e.target.value }
                    setConditions(next)
                    setEdited(false)
                  }}
                >
                  {OPS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {field && field.values.length > 0 ? (
                  <select
                    className="select"
                    value={c.value}
                    onChange={(e) => {
                      const next = [...conditions]
                      next[i] = { ...c, value: e.target.value }
                      setConditions(next)
                      setEdited(false)
                    }}
                  >
                    <option value="">— выберите —</option>
                    {c.field === 'assignee' || c.field === 'author' ? (
                      <option value="currentUser()">я (currentUser)</option>
                    ) : null}
                    {field.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    value={c.value}
                    onChange={(e) => {
                      const next = [...conditions]
                      next[i] = { ...c, value: e.target.value }
                      setConditions(next)
                      setEdited(false)
                    }}
                    placeholder="значение"
                  />
                )}

                <button
                  type="button"
                  className="btn btn--icon-quiet"
                  aria-label="Убрать условие"
                  onClick={() => {
                    setConditions(conditions.filter((_, j) => j !== i))
                    setEdited(false)
                  }}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            )
          })}

          <div className="jql">
            <span className="vk-eyebrow">Запрос</span>
            <textarea
              className="textarea mono"
              rows={2}
              value={query}
              onChange={(e) => {
                setManual(e.target.value)
                setEdited(true)
              }}
              spellCheck={false}
            />
            <div className="jql__status">
              {check === null && <span style={{ color: 'var(--tx3)' }}>введите условия</span>}
              {check?.ok && (
                <span style={{ color: 'var(--ok)' }}>
                  <Icon name="check_circle" size={14} /> найдено задач: {check.n}
                </span>
              )}
              {check && !check.ok && (
                <span style={{ color: 'var(--dang)' }}>
                  <Icon name="error" size={14} /> {check.error}
                </span>
              )}
              <span className="spacer" style={{ display: 'flex', gap: 6 }}>
                {edited && (
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => setEdited(false)}>
                    Вернуть из конструктора
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={!check?.ok}
                  onClick={() => nav(`/tasks?q=${encodeURIComponent(query)}`)}
                >
                  Открыть в списке
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={!check?.ok}
                  onClick={() => setSaveOpen(true)}
                >
                  Сохранить фильтр
                </button>
              </span>
            </div>
          </div>
        </section>

        {/* ── Результаты ───────────────────────────────────────────────── */}
        <section className="card card--clip" style={{ marginTop: 12 }}>
          <div className="card__head">
            <div className="card__title">Результаты</div>
            <span className="count-pill">{results.data?.total ?? 0}</span>
          </div>

          {!check?.ok && (
            <Empty
              icon="filter_alt"
              title="Запрос не выполнен"
              text="Соберите условия слева или исправьте текст запроса — результаты появятся автоматически."
            />
          )}

          {check?.ok &&
            (results.data?.items ?? []).map((t) => (
              <div
                key={t.key}
                className="row"
                style={{ gridTemplateColumns: '96px minmax(0,1fr) 124px 30px 78px', gap: 8 }}
                onClick={() => nav(`/tasks/${t.key}`)}
              >
                <TaskKey>{t.key}</TaskKey>
                <span className="ellipsis" style={{ fontSize: 13 }}>
                  {t.title}
                </span>
                <StatusBadge status={t.status} category={t.statusCategory} />
                <Avatar id={t.who} size="md" />
                <span className="mono" style={{ fontSize: 12, color: dueColor(t.dueState) }}>
                  {t.due}
                </span>
              </div>
            ))}

          {check?.ok && (results.data?.items.length ?? 0) === 0 && (
            <Empty title="Ничего не найдено" text="Условиям не соответствует ни одна задача." />
          )}
        </section>
      </div>

      {saveOpen && (
        <SaveDialog
          query={query}
          busy={saveFilter.isPending}
          onClose={() => setSaveOpen(false)}
          onSave={async (body) => {
            try {
              await saveFilter.mutateAsync(body)
              toast('Фильтр сохранён', String(body.name), 'ok')
              setSaveOpen(false)
            } catch (err) {
              toastError(err)
            }
          }}
        />
      )}
    </div>
  )
}

function FilterItem({
  filter,
  onPick,
  onStar,
  onDrop,
}: {
  filter: { id: string; label: string; icon: string; icf: string; n: number; error: string | null }
  onPick: () => void
  onStar?: () => void
  onDrop?: () => void
}) {
  return (
    <div className="filter-item" onClick={onPick}>
      <Icon name={filter.icon} size={16} color={filter.icf} />
      <span className="ellipsis" style={{ flex: 1, fontSize: 13 }}>
        {filter.label}
      </span>
      {filter.error ? (
        <Icon name="error" size={14} color="var(--dang)" title={filter.error} />
      ) : (
        <span className="count-pill">{filter.n}</span>
      )}
      {onStar && (
        <button
          type="button"
          className="btn btn--icon-quiet"
          aria-label="В избранное"
          onClick={(e) => {
            e.stopPropagation()
            onStar()
          }}
        >
          <Icon name="push_pin" size={14} />
        </button>
      )}
      {onDrop && (
        <button
          type="button"
          className="btn btn--icon-quiet"
          aria-label="Удалить фильтр"
          onClick={(e) => {
            e.stopPropagation()
            onDrop()
          }}
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  )
}

function SaveDialog({
  query,
  busy,
  onClose,
  onSave,
}: {
  query: string
  busy: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [favorite, setFavorite] = useState(false)
  const [shared, setShared] = useState(false)

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 460, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Сохранить фильтр"
      >
        <div className="modal__head">
          <Icon name="bookmark_add" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Сохранить фильтр</div>
          <button type="button" className="btn btn--icon-quiet spacer" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="modal__body">
          <label className="label">
            <span>Название</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: критичные в спринте"
              autoFocus
            />
          </label>
          <label className="label">
            <span>Запрос</span>
            <textarea className="textarea mono" rows={2} value={query} readOnly />
          </label>
          <div style={{ display: 'flex', gap: 16 }}>
            <label className="checkline">
              <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
              Закрепить в избранном
            </label>
            <label className="checkline">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
              Показать команде
            </label>
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--secondary btn--lg spacer" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={busy || !name.trim()}
            onClick={() => onSave({ name, query, favorite, shared })}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
