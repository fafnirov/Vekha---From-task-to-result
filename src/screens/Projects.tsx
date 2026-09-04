import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, Empty, Icon, Progress, Segmented } from '../components/ui'
import { NoQueues } from '../components/NoQueues'
import { api } from '../api/client'
import { useApiMutation, useProjects, useQueues, useTasks } from '../api/hooks'
import { useSession } from '../store/session'
import { useApp } from '../store/app'
import type { Project } from '../data/types'

const FILTERS = [
  { value: 'active', label: 'В работе' },
  { value: 'all', label: 'Все' },
  { value: 'risk', label: 'Риски' },
] as const

type Filter = (typeof FILTERS)[number]['value']

export function Projects() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { can, list: people } = useSession()
  const { toast, toastError } = useApp()

  const projects = useProjects()
  const queues = useQueues()
  const [filter, setFilter] = useState<Filter>('active')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (params.get('new') === '1' && can('sprint.manage')) {
      setCreating(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams, can])

  const save = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/projects', body),
    ['projects'],
  )

  const list = useMemo(() => {
    const all = projects.data ?? []
    if (filter === 'all') return all
    if (filter === 'risk') return all.filter((p) => p.atRisk)
    return all.filter((p) => ['active', 'risk', 'release'].includes(p.stateKey))
  }, [projects.data, filter])

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">Проекты</div>
        <span className="page__note mono">{list.length}</span>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} style={{ marginLeft: 12 }} />
        {can('sprint.manage') && (
          <button type="button" className="btn btn--primary spacer" onClick={() => setCreating(true)}>
            <Icon name="add" size={16} />
            Проект
          </button>
        )}
      </div>

      {/* Неудачная загрузка — это не «проектов нет»: сообщаем о сбое,
          а не выдумываем за пользователя состояние его данных. */}
      {projects.isError && (
        <Empty
          icon="cloud_off"
          title="Не удалось загрузить проекты"
          text="Проверьте связь и обновите страницу."
        />
      )}

      {!projects.isLoading && !projects.isError && list.length === 0 && (
        <Empty
          icon="folder_open"
          title="Проектов нет"
          text={
            (queues.data ?? []).length === 0
              ? 'Сначала создайте очередь — проект собирает её задачи вокруг общей цели, вех и сроков.'
              : 'Проект собирает задачи из очереди вокруг общей цели, вех и сроков.'
          }
        />
      )}

      <div className="cards-grid cards-grid--sm">
        {list.map((p) => (
          <ProjectCard key={p.id} project={p} onOpen={() => nav(`/projects/${encodeURIComponent(p.name)}`)} />
        ))}
      </div>

      {creating && (
        <ProjectDialog
          queues={(queues.data ?? []).map((q) => ({ key: q.key, name: q.name }))}
          people={people.filter((x) => x.active).map((x) => ({ code: x.code, name: x.name }))}
          busy={save.isPending}
          onClose={() => setCreating(false)}
          onSave={async (body) => {
            try {
              await save.mutateAsync(body)
              toast('Проект создан', String(body.name), 'ok')
              setCreating(false)
            } catch (err) {
              toastError(err, 'Проект не создан')
            }
          }}
        />
      )}
    </div>
  )
}

/** Карточка проекта: прогресс и команда считаются по настоящим задачам. */
function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const tasks = useTasks({ project: project.name, perPage: 100 })

  const team = useMemo(() => {
    const codes = new Set<string>()
    for (const t of tasks.data?.items ?? []) if (t.who) codes.add(t.who)
    return [...codes].slice(0, 5)
  }, [tasks.data])

  return (
    <div className="card card--hover" style={{ padding: 13 }} onClick={onOpen}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div className="project__mark" style={{ background: project.bg, color: project.fg }}>
          {project.abbr}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>
            {project.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
            {project.queue} · веха: {project.milestone}
          </div>
        </div>
        <span className="badge badge--sm" style={{ background: project.stBg, color: project.stFg }}>
          {project.state}
        </span>
      </div>

      <div className="project__meter">
        <span>
          {project.done} из {project.total} задач
        </span>
        <span className="mono">{project.pct}</span>
      </div>
      <Progress pct={project.pct} color={project.fg} style={{ marginTop: 6, height: 5, borderRadius: 3 }} />

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
        <span className="av-stack">
          {team.length === 0 && <span style={{ fontSize: 11, color: 'var(--tx3)' }}>нет задач</span>}
          {team.map((code) => (
            <Avatar key={code} id={code} size="base" />
          ))}
        </span>
        <span
          className="mono spacer"
          style={{ fontSize: 11, color: project.atRisk ? 'var(--dang)' : 'var(--tx2)' }}
        >
          до {project.due}
        </span>
      </div>
    </div>
  )
}

function ProjectDialog({
  queues,
  people,
  busy,
  onClose,
  onSave,
}: {
  queues: { key: string; name: string }[]
  people: { code: string; name: string }[]
  busy: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [queue, setQueue] = useState(queues[0]?.key ?? '')
  const [lead, setLead] = useState(people[0]?.code ?? '')
  const [description, setDescription] = useState('')
  const [state, setState] = useState('active')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 540, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Новый проект"
      >
        <div className="modal__head">
          <Icon name="folder_open" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Новый проект</div>
          <button type="button" className="btn btn--icon-quiet spacer" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={17} />
          </button>
        </div>

        {queues.length === 0 ? (
          <NoQueues what="проект" />
        ) : (
        <div className="modal__body">
          <label className="label">
            <span>Название</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Переезд на новый домен"
              autoFocus
            />
          </label>

          <label className="label">
            <span>Описание</span>
            <textarea
              className="textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Цель проекта и ожидаемый результат"
            />
          </label>

          <div className="grid-3">
            <label className="label">
              <span>Очередь</span>
              <select className="select" value={queue} onChange={(e) => setQueue(e.target.value)}>
                {queues.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.key} · {q.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Руководитель</span>
              <select className="select" value={lead} onChange={(e) => setLead(e.target.value)}>
                {people.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Состояние</span>
              <select className="select" value={state} onChange={(e) => setState(e.target.value)}>
                <option value="planned">запланирован</option>
                <option value="active">в работе</option>
                <option value="risk">риск</option>
                <option value="release">релиз</option>
                <option value="done">завершён</option>
              </select>
            </label>
          </div>

          <div className="grid-2">
            <label className="label">
              <span>Старт</span>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="label">
              <span>Срок</span>
              <input
                className="input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>
        </div>
        )}

        <div className="modal__foot">
          <button type="button" className="btn btn--secondary btn--lg spacer" onClick={onClose}>
            Отмена
          </button>
          {queues.length > 0 && (
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={busy}
            onClick={() =>
              onSave({
                name,
                queue,
                lead,
                description,
                state,
                startDate: startDate || null,
                dueDate: dueDate || null,
              })
            }
          >
            Создать проект
          </button>
          )}
        </div>
      </div>
    </div>
  )
}
