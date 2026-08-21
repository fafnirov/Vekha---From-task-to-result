import { useState } from 'react'
import { Avatar, Checkbox, Icon, Segmented } from './ui'
import { useUi } from '../store/ui'
import { useApp } from '../store/app'

const TYPES = [
  { value: 'task', label: 'Задача' },
  { value: 'bug', label: 'Баг' },
  { value: 'epic', label: 'Эпик' },
] as const

type TaskType = (typeof TYPES)[number]['value']

export function CreateTaskModal() {
  const ui = useUi()
  const { toast } = useApp()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TaskType>('task')
  const [error, setError] = useState(false)
  const [more, setMore] = useState(false)
  const [tags, setTags] = useState(['ui', 'frontend'])

  const submit = () => {
    if (!title.trim()) {
      setError(true)
      return
    }
    toast('Задача создана', `VEKHA-147 · ${title.trim()}`, 'ok')
    if (more) {
      setTitle('')
      setError(false)
    } else {
      ui.closeCreateModal()
    }
  }

  return (
    <div
      className="scrim"
      style={{ alignItems: 'center', zIndex: 85 }}
      onClick={ui.closeCreateModal}
    >
      <div
        className="modal"
        style={{ width: 620, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Новая задача"
      >
        <div className="modal__head">
          <Icon name="add_task" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Новая задача</div>
          <span className="count-pill">VEKHA-147</span>
          <button
            type="button"
            className="btn btn--icon-quiet spacer"
            onClick={ui.closeCreateModal}
            aria-label="Закрыть"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div
          style={{
            padding: '14px 15px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="label">
              <span>Очередь</span>
              <button type="button" className="select">
                <span className="mono" style={{ fontSize: 11, color: 'var(--ac-tx)' }}>
                  VEKHA
                </span>
                <span style={{ flex: 1, textAlign: 'left', color: 'var(--tx2)' }}>
                  Платформа
                </span>
                <Icon name="expand_more" size={16} color="var(--tx3)" />
              </button>
            </label>
            <label className="label">
              <span>Тип задачи</span>
              <Segmented
                options={TYPES}
                value={type}
                onChange={setType}
                style={{ height: 32 }}
              />
            </label>
          </div>

          <label className="label">
            <span>Заголовок</span>
            <input
              className={error ? 'input input--error' : 'input'}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (error) setError(false)
              }}
              placeholder="Например: перенести настройки уведомлений в профиль"
              style={{ height: 34, fontSize: 13 }}
            />
            {error && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  color: 'var(--dang)',
                }}
              >
                <Icon name="error" size={14} />
                Заголовок обязателен
              </span>
            )}
          </label>

          <label className="label">
            <span>Описание</span>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Контекст, ожидаемый результат, критерии приёмки"
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            <label className="label">
              <span>Исполнитель</span>
              <button type="button" className="select" style={{ padding: '0 8px' }}>
                <Avatar id="AK" size="xs" title={false} />
                <span style={{ flex: 1, textAlign: 'left' }}>Анна К.</span>
                <Icon name="expand_more" size={16} color="var(--tx3)" />
              </button>
            </label>
            <label className="label">
              <span>Приоритет</span>
              <button type="button" className="select">
                <Icon name="keyboard_arrow_up" size={16} color="var(--warn)" />
                <span style={{ flex: 1, textAlign: 'left' }}>High</span>
                <Icon name="expand_more" size={16} color="var(--tx3)" />
              </button>
            </label>
            <label className="label">
              <span>Дедлайн</span>
              <button type="button" className="select">
                <Icon name="calendar_today" size={16} color="var(--tx3)" />
                <span className="mono" style={{ flex: 1, textAlign: 'left' }}>
                  28.08.2026
                </span>
              </button>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
            <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>Теги</span>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 6,
                  background: 'var(--n-bg)',
                  color: 'var(--tx2)',
                  fontSize: 11.5,
                }}
              >
                {t}
                <button
                  type="button"
                  className="chip__x"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  aria-label={`Убрать тег ${t}`}
                >
                  <Icon name="close" size={13} />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="btn btn--dashed"
              style={{ height: 22, padding: '0 8px', fontSize: 11.5 }}
              onClick={() => {
                if (!tags.includes('navigation')) setTags([...tags, 'navigation'])
              }}
            >
              + тег
            </button>
          </div>
        </div>

        <div className="modal__foot">
          <button
            type="button"
            className="btn btn--quiet"
            style={{ padding: 0 }}
            onClick={() => setMore(!more)}
          >
            <Checkbox on={more} onClick={() => setMore(!more)} label="Создать ещё одну" />
            Создать ещё одну
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--lg spacer"
            onClick={ui.closeCreateModal}
          >
            Отмена
          </button>
          <button type="button" className="btn btn--primary btn--lg" onClick={submit}>
            Создать задачу
          </button>
        </div>
      </div>
    </div>
  )
}
