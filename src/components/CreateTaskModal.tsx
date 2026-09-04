import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Checkbox, Icon } from './ui'
import { NoQueues } from './NoQueues'
import { PRIORITY_KEY, PRIORITY_NAMES } from '../data/catalog'
import {
  useCreateTask,
  useFields,
  useProjects,
  useQueues,
  useTeams,
  useSprints,
  useTaskTypes,
  useTemplates,
} from '../api/hooks'
import { useSession } from '../store/session'
import { useUi } from '../store/ui'
import { useApp } from '../store/app'
import type { PriorityName } from '../data/types'

/** Создание задачи. Всё, что здесь выбирается, уходит в POST /api/tasks. */
export function CreateTaskModal() {
  const ui = useUi()
  const nav = useNavigate()
  const { toast, toastError } = useApp()
  const { list: people, me } = useSession()

  const queues = useQueues()
  const projects = useProjects()
  const sprints = useSprints()
  const templates = useTemplates()
  const taskTypes = useTaskTypes()
  const teams = useTeams()
  const create = useCreateTask()
  const fields = useFields()

  /*
   * Обязательные поля задаются в настройках и проверяются сервером. Форма
   * читает тот же список, чтобы отметить их звёздочкой и сказать о
   * пропуске до отправки, а не после отказа.
   */
  const required = useMemo(
    () => new Set((fields.data ?? []).filter((f) => f.req).map((f) => f.key)),
    [fields.data],
  )
  const star = (key: string) => (required.has(key) ? <span className="label__req">*</span> : null)

  const [queue, setQueue] = useState('')
  const [type, setType] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState<PriorityName>('Средний')
  const [dueDate, setDueDate] = useState('')
  const [estimate, setEstimate] = useState('')
  const [project, setProject] = useState('')
  const [team, setTeam] = useState('')
  const [sprint, setSprint] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [error, setError] = useState('')
  const [more, setMore] = useState(false)

  /* Очередь по умолчанию — первая доступная, чтобы форма была готова к вводу. */
  useEffect(() => {
    if (!queue && queues.data?.length) setQueue(queues.data[0].key)
  }, [queue, queues.data])

  const currentQueue = queues.data?.find((q) => q.key === queue)
  const nextKey = currentQueue ? `${currentQueue.key}-${currentQueue.counter + 1}` : '—'

  /* Проекты и спринты сужаются до выбранной очереди — иначе список бессмыслен. */
  const queueProjects = useMemo(
    () => (projects.data ?? []).filter((p) => !queue || p.queue === queue),
    [projects.data, queue],
  )
  const queueSprints = useMemo(
    () =>
      (sprints.data ?? []).filter((s) => (!queue || s.queue === queue) && s.state !== 'closed'),
    [sprints.data, queue],
  )

  function addTag() {
    const value = tagInput.trim().toLowerCase()
    if (value && !tags.includes(value)) setTags([...tags, value])
    setTagInput('')
  }

  function applyTemplate(id: string) {
    const template = templates.data?.find((t) => t.id === id)
    if (!template) return
    setDescription(template.body)
    setTags([...new Set([...tags, ...template.tags])])
    toast('Шаблон применён', template.name, 'info')
  }

  async function submit() {
    if (title.trim().length < 3) {
      setError('Заголовок короче трёх символов')
      return
    }
    if (!queue) {
      setError('Выберите очередь')
      return
    }

    const gaps = (fields.data ?? [])
      .filter((f) => f.req)
      .filter((f) => {
        if (f.key === 'description') return !description.trim()
        if (f.key === 'assignee') return !assignee
        if (f.key === 'sprint') return !sprint
        if (f.key === 'estimate') return estimate === ''
        if (f.key === 'dueDate') return !dueDate
        return false
      })
      .map((f) => f.label)

    if (gaps.length) {
      setError(
        gaps.length === 1
          ? `Заполните поле «${gaps[0]}»`
          : `Заполните обязательные поля: ${gaps.join(', ')}`,
      )
      return
    }
    setError('')

    try {
      const result = await create.mutateAsync({
        title: title.trim(),
        queue,
        description,
        priority: PRIORITY_KEY[priority],
        type: type || null,
        assignee: assignee || null,
        project: project || null,
        team: team || null,
        sprint: sprint || null,
        dueDate: dueDate || null,
        estimate: estimate === '' ? null : Number(estimate),
        tags,
      })

      toast('Задача создана', `${result.task.key} · ${result.task.title}`, 'ok')

      if (more) {
        setTitle('')
        setDescription('')
        setTags([])
        setEstimate('')
      } else {
        ui.closeCreateModal()
        nav(`/tasks/${result.task.key}`)
      }
    } catch (err) {
      toastError(err, 'Задача не создана')
    }
  }

  return (
    <div className="scrim" style={{ alignItems: 'center', zIndex: 85 }} onClick={ui.closeCreateModal}>
      <div
        className="modal"
        style={{ width: 640, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Новая задача"
      >
        <div className="modal__head">
          <Icon name="add_task" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Новая задача</div>
          <span className="count-pill mono">{nextKey}</span>
          <button
            type="button"
            className="btn btn--icon-quiet spacer"
            onClick={ui.closeCreateModal}
            aria-label="Закрыть"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        {!queues.isLoading && (queues.data ?? []).length === 0 ? (
          <NoQueues what="задачу" />
        ) : (
        <div className="modal__body">
          <div className="grid-2">
            <label className="label">
              <span>Очередь</span>
              <select className="select" value={queue} onChange={(e) => setQueue(e.target.value)}>
                {(queues.data ?? []).map((q) => (
                  <option key={q.id} value={q.key}>
                    {q.key} · {q.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Тип задачи</span>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                {(taskTypes.data ?? []).map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid-2">
            <label className="label">
              <span>Шаблон</span>
              <select
                className="select"
                value=""
                onChange={(e) => e.target.value && applyTemplate(e.target.value)}
              >
                <option value="">Без шаблона</option>
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="label">
            <span>Заголовок</span>
            <input
              className={error && title.trim().length < 3 ? 'input input--error' : 'input'}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (error) setError('')
              }}
              placeholder="Например: перенести настройки уведомлений в профиль"
              style={{ height: 34, fontSize: 13 }}
              autoFocus
            />
          </label>

          <label className="label">
            <span>Описание{star('description')}</span>
            <textarea
              className="textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Контекст, ожидаемый результат, критерии приёмки"
            />
          </label>

          <div className="grid-3">
            <label className="label">
              <span>Исполнитель{star('assignee')}</span>
              <div className="select-with-avatar">
                <Avatar id={assignee || null} size="xs" title={false} />
                <select
                  className="select"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Не назначен</option>
                  {people
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            </label>
            <label className="label">
              <span>Приоритет</span>
              <select
                className="select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityName)}
              >
                {PRIORITY_NAMES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Срок{star('dueDate')}</span>
              <input
                className="input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>

          <div className="grid-3">
            <label className="label">
              <span>Проект</span>
              <select className="select" value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Без проекта</option>
                {queueProjects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Команда</span>
              <select
                className="select"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                title="Поручённую команде задачу видит только она"
              >
                <option value="">Без команды</option>
                {(teams.data ?? []).map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Спринт{star('sprint')}</span>
              <select className="select" value={sprint} onChange={(e) => setSprint(e.target.value)}>
                <option value="">Без спринта</option>
                {queueSprints.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Оценка, баллы{star('estimate')}</span>
              <input
                className="input"
                type="number"
                min={0}
                max={999}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="—"
              />
            </label>
          </div>

          <div className="tagline">
            <span style={{ fontSize: 12, color: 'var(--tx2)' }}>Метки</span>
            {tags.map((t) => (
              <span key={t} className="tag">
                {t}
                <button
                  type="button"
                  className="chip__x"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  aria-label={`Убрать метка ${t}`}
                >
                  <Icon name="close" size={13} />
                </button>
              </span>
            ))}
            <input
              className="input input--inline"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag()
                }
              }}
              onBlur={addTag}
              placeholder="+ метка"
            />
          </div>

          {error && (
            <div className="form-error" role="alert">
              <Icon name="error" size={14} />
              {error}
            </div>
          )}
        </div>
        )}

        <div className="modal__foot">
          <button type="button" className="btn btn--quiet" style={{ padding: 0 }} onClick={() => setMore(!more)}>
            <Checkbox on={more} onClick={() => setMore(!more)} label="Создать ещё одну" />
            Создать ещё одну
          </button>
          <span className="spacer" style={{ fontSize: 12, color: 'var(--tx3)' }}>
            Автор: {me?.name}
          </span>
          <button type="button" className="btn btn--secondary btn--lg" onClick={ui.closeCreateModal}>
            Отмена
          </button>
          {(queues.data ?? []).length > 0 && (
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => void submit()}
              disabled={create.isPending}
            >
              {create.isPending ? 'Создаём…' : 'Создать задачу'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
