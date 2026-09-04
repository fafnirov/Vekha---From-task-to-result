import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, Empty, Icon } from '../components/ui'
import { api } from '../api/client'
import { useApiMutation, useQueues, useTeams, useWorkflows } from '../api/hooks'
import { useSession } from '../store/session'
import { useApp } from '../store/app'
import type { Queue } from '../data/types'

const GRID = '74px minmax(0,1fr) 150px 92px 128px 118px 30px'

export function Queues() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { can, list: people } = useSession()
  const { toast, toastError } = useApp()

  const queues = useQueues()
  const workflows = useWorkflows()
  const [editing, setEditing] = useState<Queue | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (params.get('new') === '1' && can('workflow.manage')) {
      setCreating(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams, can])

  const save = useApiMutation<{ id?: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => (id ? api.patch(`/api/queues/${id}`, body) : api.post('/api/queues', body)),
    ['queues'],
  )

  const remove = useApiMutation<string, unknown>(
    (id) => api.del(`/api/queues/${id}`),
    ['queues'],
  )

  const rows = queues.data ?? []

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">Очереди</div>
        <span className="page__note">контейнеры задач с собственной схемой и правами</span>
        {can('workflow.manage') && (
          <button type="button" className="btn btn--primary spacer" onClick={() => setCreating(true)}>
            <Icon name="add" size={16} />
            Очередь
          </button>
        )}
      </div>

      <div className="card card--clip">
        <div className="thead" style={{ gridTemplateColumns: GRID, gap: 10, padding: '0 13px' }}>
          <span>Ключ</span>
          <span>Название</span>
          <span>Владелец</span>
          <span style={{ textAlign: 'right' }}>Задач</span>
          <span>Схема работы</span>
          <span>Доступ</span>
          <span />
        </div>

        {queues.isLoading && <div className="skel skel--block" style={{ height: 180 }} />}

        {!queues.isLoading && rows.length === 0 && (
          <Empty
            icon="layers"
            title="Очередей пока нет"
            text="Очередь — это отдельный поток работы со своей схемой работы, доступом и нумерацией задач."
          />
        )}

        {rows.map((q) => (
          <div
            key={q.id}
            className="row row--tall"
            style={{ gridTemplateColumns: GRID, gap: 10 }}
            onClick={() => nav(`/tasks?queue=${q.key}`)}
          >
            <span className="key" style={{ fontWeight: 500 }}>
              {q.key}
            </span>
            <span style={{ fontSize: 13 }}>{q.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <Avatar id={q.owner} size="xs" title={false} />
              <span className="ellipsis" style={{ fontSize: 12, color: 'var(--tx2)' }}>
                {people.find((p) => p.code === q.owner)?.name ?? q.owner}
              </span>
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--tx2)', textAlign: 'right' }}>
              {q.n}
            </span>
            <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{q.wf}</span>
            {q.teams.length === 0 ? (
              <span
                className="badge"
                style={{ background: 'var(--n-bg)', color: 'var(--tx3)', height: 20 }}
                title="Доступ никому не выдан: очередь видят только админы и лиды"
              >
                только админы
              </span>
            ) : (
              <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {q.teams.map((t) => (
                  <span
                    key={t.id}
                    className="badge"
                    style={{ background: t.bg, color: t.fg, height: 20 }}
                    title={`Очередь открыта команде «${t.name}»`}
                  >
                    {t.name}
                  </span>
                ))}
              </span>
            )}
            {can('workflow.manage') ? (
              <button
                type="button"
                className="btn btn--icon-quiet"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(q)
                }}
                aria-label={`Настроить очередь ${q.key}`}
              >
                <Icon name="tune" size={16} />
              </button>
            ) : (
              <Icon name="chevron_right" size={16} color="var(--tx3)" />
            )}
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <QueueDialog
          queue={editing}
          workflows={(workflows.data ?? []).map((w) => w.name)}
          people={people.filter((p) => p.active).map((p) => ({ code: p.code, name: p.name }))}
          busy={save.isPending}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onDelete={
            editing
              ? async () => {
                  try {
                    await remove.mutateAsync(editing.id)
                    toast('Очередь удалена', editing.key, 'ok')
                    setEditing(null)
                  } catch (err) {
                    toastError(err, 'Не удалось удалить')
                  }
                }
              : undefined
          }
          onSave={async (body) => {
            try {
              await save.mutateAsync({ id: editing?.id, body })
              toast(editing ? 'Очередь обновлена' : 'Очередь создана', String(body.key ?? editing?.key), 'ok')
              setCreating(false)
              setEditing(null)
            } catch (err) {
              toastError(err, 'Не сохранилось')
            }
          }}
        />
      )}
    </div>
  )
}

function QueueDialog({
  queue,
  workflows,
  people,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  queue: Queue | null
  workflows: string[]
  people: { code: string; name: string }[]
  busy: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => void
  onDelete?: () => void
}) {
  const [key, setKey] = useState(queue?.key ?? '')
  const [name, setName] = useState(queue?.name ?? '')
  const [owner, setOwner] = useState(queue?.owner ?? people[0]?.code ?? '')
  const [workflow, setWorkflow] = useState(queue?.wf ?? workflows[0] ?? '')
  const [teamIds, setTeamIds] = useState<string[]>(queue?.teams.map((t) => t.id) ?? [])
  const teams = useTeams()

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 520, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={queue ? 'Настройки очереди' : 'Новая очередь'}
      >
        <div className="modal__head">
          <Icon name="layers" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {queue ? `Очередь ${queue.key}` : 'Новая очередь'}
          </div>
          <button type="button" className="btn btn--icon-quiet spacer" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="modal__body">
          <div className="grid-2">
            <label className="label">
              <span>Ключ задач</span>
              <input
                className="input"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="VEKHA"
                disabled={Boolean(queue)}
                title={queue ? 'Ключ нельзя изменить: он уже в номерах задач' : undefined}
                maxLength={10}
              />
              {queue && (
                <span style={{ fontSize: 11, color: 'var(--tx3)' }}>
                  Ключ менять нельзя — он уже стоит в номерах задач
                </span>
              )}
            </label>
            <label className="label">
              <span>Название</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Платформа"
              />
            </label>
          </div>

          <div className="grid-3">
            <label className="label">
              <span>Владелец</span>
              <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
                {people.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Схема работы</span>
              <select className="select" value={workflow} onChange={(e) => setWorkflow(e.target.value)}>
                {workflows.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/*
            Доступ выдаётся командам поимённо. Прежний выпадающий список
            уровней врал: уровень «команда» означал «любой, кто вошёл»,
            и участники видели все очереди подряд.
          */}
          <div className="label">
            <span>Кому открыта очередь</span>
            <div className="access-teams">
              {(teams.data ?? []).length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--tx3)' }}>
                  Команд пока нет — заведите их в разделе «Команды».
                </span>
              ) : (
                (teams.data ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={teamIds.includes(t.id) ? 'tag tag--outline tag--on' : 'tag tag--outline'}
                    onClick={() =>
                      setTeamIds((prev) =>
                        prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                      )
                    }
                  >
                    {t.name}
                  </button>
                ))
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--tx3)' }}>
              {teamIds.length === 0
                ? 'Никому не открыта: очередь увидят только администраторы и лиды.'
                : 'Участники отмеченных команд видят эту очередь и её задачи.'}
            </span>
          </div>

          {!queue && (
            <p style={{ fontSize: 12, color: 'var(--tx3)', margin: 0 }}>
              Ключ подставляется в номера задач: VEKHA-1, VEKHA-2 и так далее. Позже его изменить нельзя.
            </p>
          )}
        </div>

        <div className="modal__foot">
          {onDelete && (
            <button type="button" className="btn btn--danger" onClick={onDelete}>
              Удалить
            </button>
          )}
          <button type="button" className="btn btn--secondary btn--lg spacer" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={busy}
            onClick={() => onSave({ key, name, owner, workflow, teams: teamIds })}
          >
            {queue ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
