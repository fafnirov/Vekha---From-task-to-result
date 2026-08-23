import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Empty, Icon } from '../components/ui'
import { api } from '../api/client'
import { useApiMutation, useTeams } from '../api/hooks'
import { useSession } from '../store/session'
import { useApp } from '../store/app'
import type { Team } from '../data/types'

export function Teams() {
  const nav = useNavigate()
  const { can, list: people } = useSession()
  const { toast, toastError } = useApp()

  const teams = useTeams()
  const [editing, setEditing] = useState<Team | null>(null)
  const [creating, setCreating] = useState(false)

  const save = useApiMutation<{ id?: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => (id ? api.patch(`/api/teams/${id}`, body) : api.post('/api/teams', body)),
    ['teams'],
  )
  const addMember = useApiMutation<{ id: string; user: string }, unknown>(
    ({ id, user }) => api.post(`/api/teams/${id}/members`, { user }),
    ['teams'],
  )
  const dropMember = useApiMutation<{ id: string; user: string }, unknown>(
    ({ id, user }) => api.del(`/api/teams/${id}/members/${user}`),
    ['teams'],
  )
  const remove = useApiMutation<string, unknown>((id) => api.del(`/api/teams/${id}`), ['teams'])

  const list = teams.data ?? []
  const headcount = new Set(list.flatMap((t) => t.members.map((m) => m.id))).size
  const manage = can('people.manage')

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">Команды</div>
        <span className="page__note">
          {list.length} · {headcount} участников
        </span>
        {manage && (
          <button type="button" className="btn btn--primary spacer" onClick={() => setCreating(true)}>
            <Icon name="add" size={16} />
            Команда
          </button>
        )}
      </div>

      {!teams.isLoading && list.length === 0 && (
        <Empty
          icon="groups"
          title="Команд пока нет"
          text="Команда объединяет людей, чтобы видеть их общую загрузку и распределять задачи."
        />
      )}

      <div className="cards-grid">
        {list.map((tm) => (
          <div key={tm.id} className="card card--clip">
            <div className="team__head">
              <div className="team__mark" style={{ background: tm.bg, color: tm.fg }}>
                {tm.abbr}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{tm.name}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{tm.note}</div>
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: parseInt(tm.load, 10) > 100 ? 'var(--dang)' : 'var(--tx2)',
                }}
                title="Загрузка: открытые задачи против ориентира в восемь задач на человека"
              >
                {tm.load}
              </span>
              {manage && (
                <button
                  type="button"
                  className="btn btn--icon-quiet"
                  onClick={() => setEditing(tm)}
                  aria-label={`Настроить команду ${tm.name}`}
                >
                  <Icon name="tune" size={16} />
                </button>
              )}
            </div>

            {tm.members.length === 0 && <div className="team__empty">Пока никого нет</div>}

            {tm.members.map((m) => (
              <div
                key={m.id}
                className="row"
                style={{ gridTemplateColumns: '24px minmax(0,1fr) 92px 40px 26px', height: 34 }}
                onClick={() => nav(`/tasks?assignee=${m.code}`)}
              >
                <Avatar id={m.code} size="md" title={false} />
                <span className="ellipsis" style={{ fontSize: 12 }}>
                  {m.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{m.role}</span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: 'var(--tx2)', textAlign: 'right' }}
                  title="Открытых задач"
                >
                  {m.tasks}
                </span>
                {manage ? (
                  <button
                    type="button"
                    className="btn btn--icon-quiet"
                    onClick={(e) => {
                      e.stopPropagation()
                      void dropMember
                        .mutateAsync({ id: tm.id, user: m.code })
                        .catch((err) => toastError(err))
                    }}
                    aria-label={`Убрать ${m.name} из команды`}
                  >
                    <Icon name="close" size={14} />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}

            {manage && (
              <div className="team__add">
                <select
                  className="select"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    void addMember
                      .mutateAsync({ id: tm.id, user: e.target.value })
                      .catch((err) => toastError(err))
                  }}
                >
                  <option value="">+ добавить участника</option>
                  {people
                    .filter((p) => p.active && !tm.members.some((m) => m.id === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <TeamDialog
          team={editing}
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
                    toast('Команда удалена', editing.name, 'ok')
                    setEditing(null)
                  } catch (err) {
                    toastError(err)
                  }
                }
              : undefined
          }
          onSave={async (body) => {
            try {
              await save.mutateAsync({ id: editing?.id, body })
              toast(editing ? 'Команда обновлена' : 'Команда создана', String(body.name), 'ok')
              setCreating(false)
              setEditing(null)
            } catch (err) {
              toastError(err)
            }
          }}
        />
      )}
    </div>
  )
}

function TeamDialog({
  team,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  team: Team | null
  busy: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(team?.name ?? '')
  const [abbr, setAbbr] = useState(team?.abbr ?? '')
  const [note, setNote] = useState(team?.note ?? '')

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 460, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={team ? 'Настройки команды' : 'Новая команда'}
      >
        <div className="modal__head">
          <Icon name="groups" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {team ? 'Настройки команды' : 'Новая команда'}
          </div>
          <button type="button" className="btn btn--icon-quiet spacer" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="modal__body">
          <label className="label">
            <span>Название</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid-2">
            <label className="label">
              <span>Монограмма</span>
              <input
                className="input"
                value={abbr}
                onChange={(e) => setAbbr(e.target.value)}
                maxLength={3}
                placeholder="ПК"
              />
            </label>
            <label className="label">
              <span>Чем занимается</span>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
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
            onClick={() => onSave({ name, abbr, note })}
          >
            {team ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
