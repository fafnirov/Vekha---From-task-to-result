import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar, Checkbox, Empty, Icon, Segmented, Toggle, UnderlineTabs } from '../components/ui'
import { PasswordReset } from '../components/PasswordReset'
import { Tooltip } from '../components/Tooltip'
import { CATEGORY_LABEL, ROLE_LABEL } from '../data/catalog'
import { api, BASE } from '../api/client'
import {
  useApiMutation,
  useBoard,
  useFields,
  useInvites,
  usePermissions,
  useQueues,
  useResolutions,
  useRules,
  useTaskTypes,
  useTemplates,
  useWorkflows,
} from '../api/hooks'
import { useSession } from '../store/session'
import { useApp } from '../store/app'
import type { AccessRole, Workflow as WorkflowType } from '../data/types'

type TabId =
  | 'org'
  | 'workflow'
  | 'types'
  | 'fields'
  | 'permissions'
  | 'rules'
  | 'templates'
  | 'people'
  | 'board'

const TABS: { value: TabId; label: string }[] = [
  { value: 'org', label: 'Организация' },
  { value: 'workflow', label: 'Схема работы' },
  { value: 'types', label: 'Типы и резолюции' },
  { value: 'fields', label: 'Поля' },
  { value: 'permissions', label: 'Права' },
  { value: 'rules', label: 'Автоматизации' },
  { value: 'templates', label: 'Шаблоны' },
  { value: 'board', label: 'Доска' },
  { value: 'people', label: 'Участники' },
]

export function Workflow() {
  const [params, setParams] = useSearchParams()
  const { can } = useSession()
  const tabParam = params.get('tab') as TabId | null
  const [tab, setTab] = useState<TabId>(tabParam ?? 'org')

  useEffect(() => {
    if (tabParam && tabParam !== tab) setTab(tabParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam])

  function pickTab(next: TabId) {
    setTab(next)
    const p = new URLSearchParams(params)
    p.set('tab', next)
    setParams(p, { replace: true })
  }

  const manage = can('workflow.manage')

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">Настройки</div>
        <span className="page__note">
          {manage ? 'изменения применяются сразу ко всей организации' : 'только просмотр — нужны права администратора'}
        </span>
      </div>

      <UnderlineTabs options={TABS} value={tab} onChange={pickTab} />

      <div style={{ marginTop: 12 }}>
        {tab === 'org' && <OrgTab manage={manage} />}
        {tab === 'workflow' && <WorkflowTab manage={manage} />}
        {tab === 'types' && <TypesTab manage={manage} />}
        {tab === 'fields' && <FieldsTab manage={manage} />}
        {tab === 'permissions' && <PermissionsTab manage={manage} />}
        {tab === 'rules' && <RulesTab manage={manage} />}
        {tab === 'templates' && <TemplatesTab manage={manage} />}
        {tab === 'board' && <BoardTab manage={manage} />}
        {tab === 'people' && <PeopleTab />}
      </div>
    </div>
  )
}

/* ── Организация ──────────────────────────────────────────────────────── */

function OrgTab({ manage }: { manage: boolean }) {
  const { org } = useSession()
  const { toast, toastError } = useApp()

  const [name, setName] = useState(org.name)
  const [unit, setUnit] = useState(org.unit)
  const [mark, setMark] = useState(org.mark)

  // Значения приходят асинхронно: пока запрос не вернулся, в полях заглушка.
  useEffect(() => {
    setName(org.name)
    setUnit(org.unit)
    setMark(org.mark)
  }, [org.name, org.unit, org.mark])

  const save = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.patch('/api/org', body),
    ['org'],
  )

  const changed = name !== org.name || unit !== org.unit || mark !== org.mark

  return (
    <section className="card card--pad" style={{ maxWidth: 560 }}>
      <div className="card__title" style={{ marginBottom: 4 }}>
        Название пространства
      </div>
      <p className="report__hint" style={{ marginBottom: 12 }}>
        Видно в боковой панели, в хлебных крошках и на экране входа.
      </p>

      <div className="grid-2">
        <label className="label">
          <span>Название</span>
          <input
            className="input"
            value={name}
            disabled={!manage}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: KavoNet"
          />
        </label>
        <label className="label">
          <span>Подпись под названием</span>
          <input
            className="input"
            value={unit}
            disabled={!manage}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Например: Продуктовая команда"
          />
        </label>
      </div>

      <label className="label" style={{ marginTop: 12, maxWidth: 160 }}>
        <span>Монограмма</span>
        <input
          className="input"
          value={mark}
          disabled={!manage}
          maxLength={2}
          onChange={(e) => setMark(e.target.value)}
          placeholder="K"
        />
      </label>

      {manage && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!changed || name.trim().length < 2 || save.isPending}
            onClick={() =>
              void save
                .mutateAsync({ name: name.trim(), unit: unit.trim(), mark: mark.trim() || name.trim()[0] })
                .then(() => toast('Сохранено', name.trim(), 'ok'))
                .catch(toastError)
            }
          >
            Сохранить
          </button>
          {changed && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setName(org.name)
                setUnit(org.unit)
                setMark(org.mark)
              }}
            >
              Отменить
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/* ── Воркфлоу ─────────────────────────────────────────────────────────── */

function WorkflowTab({ manage }: { manage: boolean }) {
  const workflows = useWorkflows()
  const { toast, toastError } = useApp()
  const [index, setIndex] = useState(0)
  const [view, setView] = useState<'list' | 'graph'>('list')
  const [adding, setAdding] = useState(false)

  const wf = workflows.data?.[index]

  const addStatus = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.post(`/api/workflows/${id}/statuses`, body),
    ['workflow'],
  )
  const dropStatus = useApiMutation<string, unknown>((id) => api.del(`/api/statuses/${id}`), ['workflow'])
  const addTransition = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.post(`/api/workflows/${id}/transitions`, body),
    ['workflow'],
  )
  const dropTransition = useApiMutation<string, unknown>(
    (id) => api.del(`/api/transitions/${id}`),
    ['workflow'],
  )

  if (!wf) return <Empty icon="account_tree" title="Схем работы нет" text="Создайте очередь — вместе с ней появится схема работы." />

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <select className="select select--sm" value={index} onChange={(e) => setIndex(Number(e.target.value))}>
          {(workflows.data ?? []).map((w, i) => (
            <option key={w.id} value={i}>
              {w.name} · очередей: {w.queues}
            </option>
          ))}
        </select>
        <Segmented
          options={[
            { value: 'list', label: 'Список' },
            { value: 'graph', label: 'Схема' },
          ]}
          value={view}
          onChange={setView}
        />
        {manage && (
          <button type="button" className="btn btn--dashed btn--sm spacer" onClick={() => setAdding(true)}>
            <Icon name="add" size={15} />
            Статус
          </button>
        )}
      </div>

      {/* Статусы */}
      <section className="card card--pad">
        <div className="card__title" style={{ marginBottom: 10 }}>
          Статусы
        </div>
        <div className="wf-statuses">
          {wf.statuses.map((s) => (
            <span key={s.id} className="wf-pill" style={{ borderColor: s.color }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
              {s.name}
              <span className="wf-pill__cat">{CATEGORY_LABEL[s.category] ?? s.category}</span>
              {manage && (
                <button
                  type="button"
                  className="chip__x"
                  aria-label={`Удалить статус ${s.name}`}
                  onClick={() =>
                    void dropStatus
                      .mutateAsync(s.id)
                      .then(() => toast('Статус удалён', s.name, 'ok'))
                      .catch(toastError)
                  }
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </span>
          ))}
        </div>
      </section>

      {view === 'list' ? (
        <section className="card card--clip">
          <div className="thead" style={{ gridTemplateColumns: '140px 30px 140px minmax(0,1fr) 130px 30px', gap: 10, padding: '0 13px' }}>
            <span>Из статуса</span>
            <span />
            <span>В статус</span>
            <span>Условие</span>
            <span>Кому доступно</span>
            <span />
          </div>

          {wf.transitions.map((t) => (
            <div
              key={t.id}
              className="row row--static"
              style={{ gridTemplateColumns: '140px 30px 140px minmax(0,1fr) 130px 30px', gap: 10 }}
            >
              <span style={{ fontSize: 12 }}>{t.from}</span>
              <Icon name="arrow_forward" size={15} color="var(--tx3)" />
              <span style={{ fontSize: 12, fontWeight: 500 }}>{t.to}</span>
              <span className="ellipsis" style={{ fontSize: 12, color: 'var(--tx2)' }}>
                {t.cond || '—'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t.role}</span>
              {manage ? (
                <button
                  type="button"
                  className="btn btn--icon-quiet"
                  aria-label="Удалить переход"
                  onClick={() => void dropTransition.mutateAsync(t.id).catch(toastError)}
                >
                  <Icon name="close" size={15} />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}

          {manage && (
            <TransitionForm
              statuses={wf.statuses.map((s) => s.name)}
              onAdd={(body) =>
                void addTransition
                  .mutateAsync({ id: wf.id, body })
                  .then(() => toast('Переход добавлен', `${body.from} → ${body.to}`, 'ok'))
                  .catch(toastError)
              }
            />
          )}
        </section>
      ) : (
        <WorkflowGraph wf={wf} />
      )}

      {adding && (
        <StatusDialog
          busy={addStatus.isPending}
          onClose={() => setAdding(false)}
          onSave={async (body) => {
            try {
              await addStatus.mutateAsync({ id: wf.id, body })
              toast('Статус добавлен', String(body.name), 'ok')
              setAdding(false)
            } catch (err) {
              toastError(err)
            }
          }}
        />
      )}
    </div>
  )
}

/** Схема переходов: статусы раскладываются по колонкам, связи — дугами. */
function WorkflowGraph({ wf }: { wf: WorkflowType }) {
  const layout = useMemo(() => {
    const cols = 3
    return wf.statuses.map((s, i) => ({
      ...s,
      left: 30 + (i % cols) * 190,
      top: 26 + Math.floor(i / cols) * 92,
    }))
  }, [wf.statuses])

  const height = 26 + Math.ceil(wf.statuses.length / 3) * 92 + 40
  const byName = new Map(layout.map((s) => [s.name, s]))

  return (
    <section className="card card--pad" style={{ overflowX: 'auto' }}>
      <div className="wf-canvas" style={{ height, minWidth: 620 }}>
        <svg className="wf-svg" width={620} height={height} aria-hidden="true">
          {wf.transitions.map((t) => {
            const from = byName.get(t.from)
            const to = byName.get(t.to)
            if (!from || !to) return null
            return (
              <line
                key={t.id}
                x1={from.left + 70}
                y1={from.top + 16}
                x2={to.left + 70}
                y2={to.top + 16}
                stroke="var(--border2)"
                strokeWidth={1}
              />
            )
          })}
        </svg>

        {layout.map((s) => (
          <div
            key={s.id}
            className="wf-node"
            style={{ left: s.left, top: s.top, borderColor: s.color }}
            title={`${s.name} · ${CATEGORY_LABEL[s.category] ?? s.category}`}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
      <p className="report__hint" style={{ marginTop: 8 }}>
        Линии показывают разрешённые переходы. Задача не сможет попасть из статуса в статус, если перехода нет.
      </p>
    </section>
  )
}

function TransitionForm({
  statuses,
  onAdd,
}: {
  statuses: string[]
  onAdd: (body: Record<string, unknown>) => void
}) {
  const [from, setFrom] = useState(statuses[0] ?? '')
  const [to, setTo] = useState(statuses[1] ?? '')
  const [condition, setCondition] = useState('')
  const [role, setRole] = useState<AccessRole>('member')

  return (
    <div className="row row--static" style={{ gridTemplateColumns: '140px 30px 140px minmax(0,1fr) 130px 90px', gap: 10 }}>
      <select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
        {statuses.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <Icon name="arrow_forward" size={15} color="var(--tx3)" />
      <select className="select" value={to} onChange={(e) => setTo(e.target.value)}>
        {statuses.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <input
        className="input"
        value={condition}
        onChange={(e) => setCondition(e.target.value)}
        placeholder="Условие (текстом, для команды)"
      />
      <select className="select" value={role} onChange={(e) => setRole(e.target.value as AccessRole)}>
        {(['viewer', 'member', 'manager', 'admin'] as AccessRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        disabled={from === to}
        onClick={() => onAdd({ from, to, condition, role })}
      >
        Добавить
      </button>
    </div>
  )
}

function StatusDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('todo')

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal__head">
          <Icon name="flag" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Новый статус</div>
          <button type="button" className="btn btn--icon-quiet spacer" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="modal__body">
          <label className="label">
            <span>Название</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="label">
            <span>Категория</span>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="todo">К выполнению</option>
              <option value="inprogress">В работе</option>
              <option value="done">Завершено</option>
              <option value="blocked">Заблокировано</option>
            </select>
          </label>
          <p className="report__hint">
            Категория определяет цвет статуса и то, как задача учитывается в отчётах.
          </p>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--secondary btn--lg spacer" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={busy || !name.trim()}
            onClick={() => onSave({ name, category })}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Типы задач и резолюции ───────────────────────────────────────────── */

const RESOLUTION_TONE: Record<string, { label: string; bg: string; fg: string }> = {
  success: { label: 'успех', bg: 'var(--ok-bg)', fg: 'var(--ok)' },
  neutral: { label: 'нейтрально', bg: 'var(--n-bg)', fg: 'var(--tx2)' },
  rejected: { label: 'отказ', bg: 'var(--dang-bg)', fg: 'var(--dang)' },
}

function TypesTab({ manage }: { manage: boolean }) {
  const types = useTaskTypes()
  const resolutions = useResolutions()
  const { toast, toastError } = useApp()

  const [typeName, setTypeName] = useState('')
  const [resName, setResName] = useState('')
  const [resKind, setResKind] = useState('neutral')

  const addType = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/task-types', body),
    ['workflow'],
  )
  const dropType = useApiMutation<string, unknown>(
    (id) => api.del(`/api/task-types/${id}`),
    ['workflow'],
  )
  const addRes = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/resolutions', body),
    ['workflow'],
  )
  const dropRes = useApiMutation<string, unknown>(
    (id) => api.del(`/api/resolutions/${id}`),
    ['workflow'],
  )

  return (
    <div className="split" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
      <section className="card card--clip">
        <div className="card__head">
          <div className="card__title">Типы задач</div>
          <span className="count-pill">{(types.data ?? []).length}</span>
        </div>

        <p className="report__hint" style={{ padding: '0 13px 10px' }}>
          Тип отличает ошибку от улучшения в списках и на доске. Удалить можно
          только тот, которым никто не пользуется.
        </p>

        {(types.data ?? []).map((t) => (
          <div
            key={t.id}
            className="row row--static"
            style={{ gridTemplateColumns: '26px minmax(0,1fr) 70px 30px', gap: 10 }}
          >
            <Icon name={t.icon} size={17} color={t.color} />
            <span style={{ fontSize: 13 }}>
              {t.name}
              {t.epic && <span className="field__sys">эпик</span>}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'right' }}>
              {t.n}
            </span>
            {manage && !t.system ? (
              <button
                type="button"
                className="btn btn--icon-quiet"
                aria-label={`Удалить тип ${t.name}`}
                onClick={() => void dropType.mutateAsync(t.id).catch(toastError)}
              >
                <Icon name="close" size={15} />
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}

        {manage && (
          <div className="checkitem checkitem--add">
            <Icon name="add" size={16} color="var(--tx3)" />
            <input
              className="input input--bare"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              placeholder="Новый тип и ↵"
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !typeName.trim()) return
                e.preventDefault()
                void addType
                  .mutateAsync({ name: typeName.trim() })
                  .then(() => {
                    toast('Тип добавлен', typeName.trim(), 'ok')
                    setTypeName('')
                  })
                  .catch(toastError)
              }}
            />
          </div>
        )}
      </section>

      <section className="card card--clip">
        <div className="card__head">
          <div className="card__title">Резолюции</div>
          <span className="count-pill">{(resolutions.data ?? []).length}</span>
        </div>

        <p className="report__hint" style={{ padding: '0 13px 10px' }}>
          Причина закрытия. Без неё «Готово» не отличает решённую задачу от
          отменённой, и отчёты приписывают команде чужую заслугу.
        </p>

        {(resolutions.data ?? []).map((r) => {
          const tone = RESOLUTION_TONE[r.kind] ?? RESOLUTION_TONE.neutral
          return (
            <div
              key={r.id}
              className="row row--static"
              style={{ gridTemplateColumns: 'minmax(0,1fr) 106px 60px 30px', gap: 10 }}
            >
              <span style={{ fontSize: 13 }}>{r.name}</span>
              <span className="badge badge--sm" style={{ background: tone.bg, color: tone.fg }}>
                {tone.label}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'right' }}>
                {r.n}
              </span>
              {manage && !r.system ? (
                <button
                  type="button"
                  className="btn btn--icon-quiet"
                  aria-label={`Удалить резолюцию ${r.name}`}
                  onClick={() => void dropRes.mutateAsync(r.id).catch(toastError)}
                >
                  <Icon name="close" size={15} />
                </button>
              ) : (
                <span />
              )}
            </div>
          )
        })}

        {manage && (
          <div className="checkitem checkitem--add" style={{ gap: 8 }}>
            <Icon name="add" size={16} color="var(--tx3)" />
            <input
              className="input input--bare"
              value={resName}
              onChange={(e) => setResName(e.target.value)}
              placeholder="Новая резолюция"
            />
            <select
              className="select select--sm"
              value={resKind}
              onChange={(e) => setResKind(e.target.value)}
            >
              <option value="success">успех</option>
              <option value="neutral">нейтрально</option>
              <option value="rejected">отказ</option>
            </select>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={!resName.trim()}
              onClick={() =>
                void addRes
                  .mutateAsync({ name: resName.trim(), kind: resKind })
                  .then(() => {
                    toast('Резолюция добавлена', resName.trim(), 'ok')
                    setResName('')
                  })
                  .catch(toastError)
              }
            >
              Добавить
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

/* ── Поля ─────────────────────────────────────────────────────────────── */

function FieldsTab({ manage }: { manage: boolean }) {
  const fields = useFields()
  const { toastError } = useApp()
  const patch = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.patch(`/api/fields/${id}`, body),
    ['workflow'],
  )

  const GRID = '30px minmax(0,1fr) 110px 90px 90px 90px'

  return (
    <section className="card card--clip">
      <div className="thead" style={{ gridTemplateColumns: GRID, gap: 10, padding: '0 13px' }}>
        <span />
        <span>Поле</span>
        <span>Тип</span>
        <span>Экран</span>
        <span>Обязательное</span>
        <span>На карточке</span>
      </div>

      {(fields.data ?? []).map((f) => (
        <div key={f.id} className="row row--static" style={{ gridTemplateColumns: GRID, gap: 10 }}>
          <Icon name={f.icon} size={17} color="var(--tx2)" />
          <span style={{ fontSize: 13 }}>
            {f.label}
            {f.system && <span className="field__sys">системное</span>}
          </span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--tx3)' }}>
            {f.type}
          </span>
          <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{f.screen}</span>
          <Toggle
            on={f.req}
            label={`Обязательное поле ${f.label}`}
            onClick={() =>
              manage && void patch.mutateAsync({ id: f.id, body: { required: !f.req } }).catch(toastError)
            }
          />
          <Toggle
            on={f.card}
            label={`Показывать ${f.label} на карточке`}
            onClick={() =>
              manage && void patch.mutateAsync({ id: f.id, body: { onCard: !f.card } }).catch(toastError)
            }
          />
        </div>
      ))}
    </section>
  )
}

/* ── Права ────────────────────────────────────────────────────────────── */

function PermissionsTab({ manage }: { manage: boolean }) {
  const permissions = usePermissions()
  const { toastError } = useApp()
  const patch = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.patch('/api/permissions', body),
    ['workflow'],
  )

  const roles = permissions.data?.roles ?? []
  const grid = `minmax(0,1fr) repeat(${roles.length},92px)`

  return (
    <section className="card card--clip">
      <div className="thead" style={{ gridTemplateColumns: grid, gap: 10, padding: '0 13px' }}>
        <span>Действие</span>
        {roles.map((r) => (
          <span key={r.key} style={{ textAlign: 'center' }}>
            {r.label}
          </span>
        ))}
      </div>

      {(permissions.data?.rows ?? []).map((row) => (
        <div key={row.id} className="row row--static" style={{ gridTemplateColumns: grid, gap: 10 }}>
          <span style={{ fontSize: 13 }}>{row.label}</span>
          {row.cells.map((cell, i) => (
            <span key={roles[i]?.key ?? i} style={{ justifySelf: 'center' }}>
              <Checkbox
                on={cell}
                tone="ok"
                label={`${row.label} — ${roles[i]?.label}`}
                onClick={() =>
                  manage &&
                  void patch
                    .mutateAsync({ key: row.id, role: roles[i].key, allowed: !cell })
                    .catch(toastError)
                }
              />
            </span>
          ))}
        </div>
      ))}

      <p className="report__hint" style={{ padding: '10px 13px' }}>
        Права проверяются на сервере: снятая галочка закрывает действие в API, а не только прячет кнопку.
      </p>
    </section>
  )
}

/* ── Автоматизации ────────────────────────────────────────────────────── */

function RulesTab({ manage }: { manage: boolean }) {
  const rules = useRules()
  const queues = useQueues()
  const [params, setParams] = useSearchParams()
  const { toast, toastError } = useApp()
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (params.get('new') === '1' && manage) {
      setCreating(true)
      const p = new URLSearchParams(params)
      p.delete('new')
      setParams(p, { replace: true })
    }
  }, [params, setParams, manage])

  const patch = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.patch(`/api/rules/${id}`, body),
    ['workflow'],
  )
  const create = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/rules', body),
    ['workflow'],
  )
  const drop = useApiMutation<string, unknown>((id) => api.del(`/api/rules/${id}`), ['workflow'])

  return (
    <div className="stack">
      {manage && (
        <div>
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <Icon name="add" size={16} />
            Правило
          </button>
        </div>
      )}

      {(rules.data ?? []).length === 0 && (
        <Empty
          icon="bolt"
          title="Автоматизаций нет"
          text="Правило срабатывает на событие, проверяет условие и выполняет действие — например уведомляет проверяющего."
        />
      )}

      {(rules.data ?? []).map((r) => (
        <section key={r.id} className="card card--pad rule">
          <span className="rule__icon" style={{ color: r.iconFg }}>
            <Icon name={r.icon} size={18} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
            <div className="rule__flow">
              <span className="rule__chip">{r.triggerLabel}</span>
              <Icon name="arrow_forward" size={13} color="var(--tx3)" />
              <span className="rule__chip mono">{r.cond}</span>
              <Icon name="arrow_forward" size={13} color="var(--tx3)" />
              <span className="rule__chip">{r.action}</span>
            </div>
            <div className="rule__meta">
              {r.queue ? `очередь ${r.queue}` : 'все очереди'} · {r.runs}
              {r.lastRun && ` · последний ${r.lastRun}`}
            </div>
          </div>
          <Toggle
            on={r.on}
            label={`Правило ${r.name}`}
            onClick={() =>
              manage &&
              void patch
                .mutateAsync({ id: r.id, body: { enabled: !r.on } })
                .then(() => toast(r.on ? 'Правило выключено' : 'Правило включено', r.name, 'info'))
                .catch(toastError)
            }
          />
          {manage && (
            <button
              type="button"
              className="btn btn--icon-quiet"
              aria-label="Удалить правило"
              onClick={() => void drop.mutateAsync(r.id).catch(toastError)}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </section>
      ))}

      {creating && (
        <RuleDialog
          queues={(queues.data ?? []).map((q) => q.key)}
          busy={create.isPending}
          onClose={() => setCreating(false)}
          onSave={async (body) => {
            try {
              await create.mutateAsync(body)
              toast('Правило создано', String(body.name), 'ok')
              setCreating(false)
            } catch (err) {
              toastError(err)
            }
          }}
        />
      )}
    </div>
  )
}

function RuleDialog({
  queues,
  busy,
  onClose,
  onSave,
}: {
  queues: string[]
  busy: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('status_changed')
  const [queue, setQueue] = useState('')
  const [field, setField] = useState('status')
  const [value, setValue] = useState('На проверке')
  const [actionType, setActionType] = useState('notify')
  const [actionValue, setActionValue] = useState('')

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 560, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Новое правило"
      >
        <div className="modal__head">
          <Icon name="bolt" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Новое правило</div>
          <button type="button" className="btn btn--icon-quiet spacer" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="modal__body">
          <label className="label">
            <span>Название</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>

          <div className="grid-2">
            <label className="label">
              <span>Когда</span>
              <select className="select" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                <option value="task_created">задача создана</option>
                <option value="status_changed">сменился статус</option>
                <option value="task_closed">задача закрыта</option>
                <option value="schedule">ежедневно</option>
              </select>
            </label>
            <label className="label">
              <span>Очередь</span>
              <select className="select" value={queue} onChange={(e) => setQueue(e.target.value)}>
                <option value="">все очереди</option>
                {queues.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid-2">
            <label className="label">
              <span>Если поле</span>
              <select className="select" value={field} onChange={(e) => setField(e.target.value)}>
                <option value="status">статус</option>
                <option value="category">категория статуса</option>
                <option value="priority">приоритет</option>
                <option value="tags">метка</option>
                <option value="overdue">просрочено</option>
                <option value="subtasksAllDone">все подзадачи закрыты</option>
              </select>
            </label>
            <label className="label">
              <span>Равно</span>
              <input
                className="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={field === 'overdue' ? 'да' : 'На проверке'}
              />
            </label>
          </div>

          <div className="grid-2">
            <label className="label">
              <span>То сделать</span>
              <select className="select" value={actionType} onChange={(e) => setActionType(e.target.value)}>
                <option value="notify">уведомить</option>
                <option value="set_priority">сменить приоритет</option>
                <option value="set_status">сменить статус</option>
                <option value="set_assignee">назначить исполнителя</option>
                <option value="add_tag">добавить метка</option>
                <option value="add_comment">добавить комментарий</option>
              </select>
            </label>
            <label className="label">
              <span>Значение</span>
              <input
                className="input"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                placeholder={actionType === 'notify' ? 'текст уведомления' : 'Высокий / Готово / код участника'}
              />
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
            onClick={() =>
              onSave({
                name,
                trigger,
                queue: queue || null,
                condition: {
                  all: [
                    {
                      field,
                      op: field === 'overdue' || field === 'subtasksAllDone' ? 'is' : field === 'tags' ? 'contains' : 'eq',
                      value: field === 'overdue' || field === 'subtasksAllDone' ? true : value,
                    },
                  ],
                },
                actions: [
                  actionType === 'notify'
                    ? { type: 'notify', role: 'watchers', value: actionValue || undefined }
                    : { type: actionType, value: actionValue },
                ],
              })
            }
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Шаблоны ──────────────────────────────────────────────────────────── */

function TemplatesTab({ manage }: { manage: boolean }) {
  const templates = useTemplates()
  const { toastError } = useApp()
  const drop = useApiMutation<string, unknown>((id) => api.del(`/api/templates/${id}`), ['workflow'])

  return (
    <div className="cards-grid">
      {(templates.data ?? []).map((t) => (
        <section key={t.id} className="card card--pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name={t.icon} size={18} color="var(--ac)" />
            <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t.name}</div>
            {manage && (
              <button
                type="button"
                className="btn btn--icon-quiet"
                aria-label="Удалить шаблон"
                onClick={() => void drop.mutateAsync(t.id).catch(toastError)}
              >
                <Icon name="close" size={15} />
              </button>
            )}
          </div>
          <p className="pretty" style={{ fontSize: 12, color: 'var(--tx2)', margin: '8px 0 0' }}>
            {t.note}
          </p>
          <div className="tagline tagline--tight" style={{ marginTop: 8 }}>
            {t.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/* ── Колонки доски ────────────────────────────────────────────────────── */

function BoardTab({ manage }: { manage: boolean }) {
  const board = useBoard()
  const { toast, toastError } = useApp()
  const patch = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.patch(`/api/board/columns/${id}`, body),
    ['board'],
  )

  return (
    <section className="card card--clip">
      <div className="thead" style={{ gridTemplateColumns: '160px minmax(0,1fr) 120px', gap: 10, padding: '0 13px' }}>
        <span>Колонка</span>
        <span>Статусы</span>
        <span>Предел задач в колонке</span>
      </div>

      {(board.data?.columns ?? []).map((c) => (
        <div key={c.id} className="row row--static" style={{ gridTemplateColumns: '160px minmax(0,1fr) 120px', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
          <span className="tagline tagline--tight">
            {c.statuses.map((s) => (
              <span key={s} className="tag">
                {s}
              </span>
            ))}
          </span>
          <input
            className="input"
            type="number"
            min={0}
            max={99}
            defaultValue={c.wipLimit}
            disabled={!manage}
            onBlur={(e) => {
              const value = Number(e.target.value)
              if (value !== c.wipLimit) {
                void patch
                  .mutateAsync({ id: c.id, body: { wipLimit: value } })
                  .then(() => toast('Лимит обновлён', `${c.name}: ${value || 'без лимита'}`, 'ok'))
                  .catch(toastError)
              }
            }}
          />
        </div>
      ))}

      <p className="report__hint" style={{ padding: '10px 13px' }}>
        Ноль означает «без лимита». Превышение подсвечивает шапку колонки, но не
        запрещает перенос: лимит здесь — сигнал команде, а не запрет.
      </p>
    </section>
  )
}

/* ── Участники ────────────────────────────────────────────────────────── */

function PeopleTab() {
  const { list, can, me, org } = useSession()
  const { toast, toastError } = useApp()
  const manage = can('people.manage')
  const invites = useInvites(manage)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AccessRole>('member')

  const patchUser = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.patch(`/api/people/${id}`, body),
    ['people'],
  )
  const invite = useApiMutation<Record<string, unknown>, { token: string }>(
    (body) => api.post('/api/invites', body),
    ['invites'],
  )

  /*
   * Заведение учётной записи прямо в интерфейсе. Почты в системе нет, а
   * при закрытой регистрации не работают и приглашения — значит путь
   * дать человеку доступ должен быть здесь, а не командой на сервере.
   */
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [addError, setAddError] = useState('')
  const addPerson = useApiMutation<Record<string, unknown>, { name: string }>(
    (body) => api.post('/api/people', body),
    ['people'],
  )

  /** Пароль, который не стыдно выдать: 12 знаков, без похожих символов. */
  function suggestPassword() {
    const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.getRandomValues(new Uint32Array(12))
    setNewPassword([...bytes].map((n) => alphabet[n % alphabet.length]).join(''))
  }

  async function createPerson() {
    setAddError('')
    if (newName.trim().length < 2) return setAddError('Укажите имя — его видит вся команда')
    if (!email.trim()) return setAddError('Укажите почту')
    if (newPassword.length < 8) return setAddError('Пароль короче восьми символов')
    try {
      const created = await addPerson.mutateAsync({
        email: email.trim(),
        name: newName.trim(),
        password: newPassword,
        role,
      })
      toast('Учётная запись создана', `${created.name} — передайте пароль лично`, 'ok')
      setEmail('')
      setNewName('')
      setNewPassword('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Не удалось создать')
    }
  }
  const dropInvite = useApiMutation<string, unknown>((id) => api.del(`/api/invites/${id}`), ['invites'])

  /*
   * Сброс пароля администратором. Почты в системе нет, поэтому «забыли
   * пароль» работает так: админ выпускает временный пароль и передаёт его
   * лично. Ответ показывается один раз — держим его в состоянии до
   * закрытия окна.
   */
  const [reset, setReset] = useState<{
    id: string
    name: string
    email: string
    password: string | null
  } | null>(null)
  const resetPassword = useApiMutation<
    { id: string },
    { password: string; email: string; name: string }
  >(({ id }) => api.post(`/api/people/${id}/password`, {}), ['people'])

  const GRID = '30px minmax(0,1fr) 180px 130px 110px 36px'

  return (
    <div className="stack">
      <section className="card card--clip">
        <div className="thead" style={{ gridTemplateColumns: GRID, gap: 10, padding: '0 13px' }}>
          <span />
          <span>Участник</span>
          <span>Почта</span>
          <span>Роль</span>
          <span>Активен</span>
          <span />
        </div>

        {list.map((p) => (
          <div key={p.id} className="row row--static" style={{ gridTemplateColumns: GRID, gap: 10 }}>
            <Avatar id={p.code} size="md" title={false} />
            <span style={{ minWidth: 0 }}>
              <span className="ellipsis" style={{ display: 'block', fontSize: 13 }}>
                {p.name}
                {p.id === me?.id && <span className="field__sys">это вы</span>}
              </span>
              <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{p.role}</span>
            </span>
            <span className="ellipsis" style={{ fontSize: 12, color: 'var(--tx2)' }}>
              {p.email}
            </span>
            <select
              className="select"
              value={p.accessRole}
              disabled={!manage}
              onChange={(e) =>
                void patchUser
                  .mutateAsync({ id: p.id, body: { role: e.target.value } })
                  .then(() => toast('Роль изменена', `${p.name}: ${ROLE_LABEL[e.target.value]}`, 'ok'))
                  .catch(toastError)
              }
            >
              {(['admin', 'manager', 'member', 'viewer'] as AccessRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <Toggle
              on={p.active}
              label={`Доступ для ${p.name}`}
              onClick={() =>
                manage &&
                void patchUser.mutateAsync({ id: p.id, body: { active: !p.active } }).catch(toastError)
              }
            />
            {manage ? (
              <Tooltip label="Сбросить пароль" hint="Выдаст временный — покажем один раз" side="left">
                <button
                  type="button"
                  className="btn btn--icon-quiet"
                  aria-label={`Сбросить пароль для ${p.name}`}
                  onClick={() =>
                    setReset({ id: p.id, name: p.name, email: p.email, password: null })
                  }
                >
                  <Icon name="key" size={15} />
                </button>
              </Tooltip>
            ) : (
              <span />
            )}
          </div>
        ))}
      </section>

      {manage && (
        <section className="card card--pad">
          <div className="card__title" style={{ marginBottom: 4 }}>
            Добавить участника
          </div>
          <p className="report__hint" style={{ margin: '0 0 12px' }}>
            Учётная запись заводится сразу: человек входит по этой почте и паролю.
            Пароль передайте лично — писем трекер не отправляет.
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="label" style={{ flex: 1, minWidth: 170 }}>
              <span>Имя и фамилия</span>
              <input
                className="input"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setAddError('')
                }}
                placeholder="Максим Капранов"
              />
            </label>
            <label className="label" style={{ flex: 1, minWidth: 190 }}>
              <span>Почта</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setAddError('')
                }}
                placeholder="name@company.ru"
              />
            </label>
            <label className="label" style={{ flex: 1, minWidth: 190 }}>
              <span>Пароль</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setAddError('')
                  }}
                  placeholder="не короче восьми знаков"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <Tooltip label="Придумать пароль" hint="12 знаков без похожих символов">
                  <button type="button" className="btn btn--secondary" onClick={suggestPassword}>
                    <Icon name="casino" size={16} />
                  </button>
                </Tooltip>
              </div>
            </label>
            <label className="label" style={{ width: 150 }}>
              <span>Роль</span>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value as AccessRole)}>
                {(['admin', 'manager', 'member', 'viewer'] as AccessRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--primary"
              disabled={addPerson.isPending}
              onClick={() => void createPerson()}
            >
              {addPerson.isPending ? 'Создаю…' : 'Создать'}
            </button>
          </div>

          {addError && (
            <div className="form__error" style={{ marginTop: 10 }}>
              <Icon name="error" size={15} />
              {addError}
            </div>
          )}
        </section>
      )}

      {/* Приглашения работают только там, где регистрация открыта. */}
      {manage && !org.registrationClosed && (
        <section className="card card--pad">
          <div className="card__title" style={{ marginBottom: 10 }}>
            Или пригласить ссылкой
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="label" style={{ flex: 1, minWidth: 220 }}>
              <span>Почта</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.ru"
              />
            </label>
            <label className="label" style={{ width: 150 }}>
              <span>Роль</span>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value as AccessRole)}>
                {(['admin', 'manager', 'member', 'viewer'] as AccessRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!email.trim() || invite.isPending}
              onClick={() =>
                void invite
                  .mutateAsync({ email, role })
                  .then(() => {
                    setEmail('')
                    toast('Приглашение создано', 'Скопируйте ссылку из списка ниже', 'ok')
                  })
                  .catch(toastError)
              }
            >
              Пригласить
            </button>
          </div>

          <p className="report__hint" style={{ marginTop: 8 }}>
            Письма приложение не отправляет: скопируйте ссылку и передайте её человеку любым удобным способом.
          </p>

          {(invites.data ?? []).length > 0 && (
            <div className="invites">
              {(invites.data ?? []).map((i) => {
                const link = `${window.location.origin}${BASE}/?invite=${i.token}`
                return (
                  <div key={i.id} className="invite">
                    <Icon name="mail" size={16} color="var(--tx2)" />
                    <span style={{ fontSize: 12, minWidth: 0, flex: 1 }} className="ellipsis">
                      {i.email} · {ROLE_LABEL[i.role]}
                      {i.expired && <span style={{ color: 'var(--dang)' }}> · истекло</span>}
                    </span>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(link)
                          .then(() => toast('Ссылка скопирована', i.email, 'ok'))
                          .catch(() => toast('Не удалось скопировать', link, 'warn'))
                      }}
                    >
                      Скопировать ссылку
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon-quiet"
                      aria-label="Отозвать приглашение"
                      onClick={() => void dropInvite.mutateAsync(i.id).catch(toastError)}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {reset && (
        <PasswordReset
          name={reset.name}
          email={reset.email}
          password={reset.password}
          busy={resetPassword.isPending}
          onConfirm={() =>
            void resetPassword
              .mutateAsync({ id: reset.id })
              .then((r) => setReset({ ...reset, password: r.password }))
              .catch((err) => {
                setReset(null)
                toastError(err)
              })
          }
          onClose={() => setReset(null)}
        />
      )}
    </div>
  )
}
