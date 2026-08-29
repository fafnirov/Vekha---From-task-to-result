import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Checkbox, Icon, Progress } from './ui'
import { api } from '../api/client'
import { useApiMutation, useChecklist } from '../api/hooks'
import { useApp } from '../store/app'

/**
 * Чек-лист задачи: мелкие шаги, которые не заслуживают отдельной задачи,
 * но которые нужно не забыть. Любой пункт можно превратить в подзадачу,
 * если он всё-таки перерос чек-лист.
 */
export function Checklist({ taskKey, editable }: { taskKey: string; editable: boolean }) {
  const { toast, toastError } = useApp()
  const items = useChecklist(taskKey)
  const [text, setText] = useState('')

  const add = useApiMutation<string, unknown>(
    (value) => api.post(`/api/tasks/${encodeURIComponent(taskKey)}/checklist`, { text: value }),
    ['tasks'],
  )
  const patch = useApiMutation<{ id: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) => api.patch(`/api/checklist/${id}`, body),
    ['tasks'],
  )
  const drop = useApiMutation<string, unknown>((id) => api.del(`/api/checklist/${id}`), ['tasks'])
  const promote = useApiMutation<string, { key: string }>(
    (id) => api.post(`/api/checklist/${id}/promote`),
    ['tasks', 'board'],
  )

  const list = items.data ?? []
  const done = list.filter((i) => i.done).length
  const pct = list.length ? `${Math.round((done / list.length) * 100)}%` : '0%'

  async function submit() {
    const value = text.trim()
    if (!value) return
    try {
      await add.mutateAsync(value)
      setText('')
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <section className="card card--clip" style={{ marginTop: 12 }}>
      <div className="card__head">
        <div className="card__title">Чек-лист</div>
        {list.length > 0 && (
          <>
            <span className="count-pill">
              {done} / {list.length}
            </span>
            <Progress
              pct={pct}
              color={done === list.length ? 'var(--ok)' : 'var(--ac)'}
              variant="thin"
              style={{ width: 120, marginLeft: 8 }}
            />
          </>
        )}
      </div>

      {list.length === 0 && !editable && <div className="task__none">Чек-листа нет</div>}

      {list.map((item) => (
        <div key={item.id} className="checkitem">
          <Checkbox
            small
            tone="ok"
            on={item.done}
            label={item.text}
            onClick={() => {
              if (!editable) return
              void patch.mutateAsync({ id: item.id, body: { done: !item.done } }).catch(toastError)
            }}
          />

          <span className={item.done ? 'checkitem__text checkitem__text--done' : 'checkitem__text'}>
            {item.text}
          </span>

          {item.spawnedKey && (
            <Link to={`/tasks/${item.spawnedKey}`} className="checkitem__link mono">
              {item.spawnedKey}
            </Link>
          )}

          {item.who && <Avatar id={item.who} size="sm" />}

          {editable && !item.spawnedKey && (
            <button
              type="button"
              className="btn btn--icon-quiet"
              title="Превратить в подзадачу"
              onClick={() =>
                void promote
                  .mutateAsync(item.id)
                  .then((r) => toast('Создана подзадача', r.key, 'ok'))
                  .catch(toastError)
              }
            >
              <Icon name="move_up" size={15} />
            </button>
          )}

          {editable && (
            <button
              type="button"
              className="btn btn--icon-quiet"
              title="Удалить пункт"
              onClick={() => void drop.mutateAsync(item.id).catch(toastError)}
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
      ))}

      {editable && (
        <div className="checkitem checkitem--add">
          <Icon name="add" size={16} color="var(--tx3)" />
          <input
            className="input input--bare"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Добавить пункт и нажать ↵"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submit()
              }
            }}
          />
        </div>
      )}
    </section>
  )
}
