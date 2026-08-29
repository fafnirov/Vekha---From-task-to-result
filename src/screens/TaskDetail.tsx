import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Empty,
  Icon,
  PriorityChip,
  Progress,
  StatusBadge,
  Tag,
  TaskKey,
  UnderlineTabs,
} from '../components/ui'
import { PRIORITY_KEY, PRIORITY_NAMES, dueColor, fileSize } from '../data/catalog'
import { Checklist } from '../components/Checklist'
import { ResolutionDialog, type ResolutionOption } from '../components/ResolutionDialog'
import { api, ApiError } from '../api/client'
import {
  useAddComment,
  useApiMutation,
  useComments,
  useHistory,
  useInvalidate,
  useProjects,
  useSprints,
  useTask,
  useTaskTypes,
  useUpdateTask,
} from '../api/hooks'
import { useSession } from '../store/session'
import { useApp } from '../store/app'
import type { PriorityName } from '../data/types'

type TabId = 'comments' | 'history' | 'all'

const TABS: { value: TabId; label: string }[] = [
  { value: 'comments', label: 'Комментарии' },
  { value: 'history', label: 'История' },
  { value: 'all', label: 'Всё' },
]

export function TaskDetail() {
  const { key = '' } = useParams()
  const nav = useNavigate()
  const { me, list: people, can } = useSession()
  const { toast, toastError } = useApp()
  const invalidate = useInvalidate()

  const detail = useTask(key)
  const comments = useComments(key)
  const history = useHistory(key)
  const projects = useProjects()
  const sprints = useSprints()
  const taskTypes = useTaskTypes()
  const update = useUpdateTask()
  const addComment = useAddComment()

  const [tab, setTab] = useState<TabId>('comments')
  const [editingDescription, setEditingDescription] = useState(false)
  const [draft, setDraft] = useState('')
  const [commentText, setCommentText] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  /* Диалог причины закрытия: сервер присылает варианты вместе с отказом. */
  const [closing, setClosing] = useState<{ to: string; options: ResolutionOption[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const task = detail.data?.task

  /*
   * Черновики подтягиваются из задачи, но не поверх открытой формы:
   * иначе правка коллеги, прилетевшая по SSE, стёрла бы недописанный
   * пользователем текст.
   */
  useEffect(() => {
    if (task && !editingDescription) setDraft(task.description)
  }, [task?.id, task?.description, editingDescription])

  useEffect(() => {
    if (task && !editingTitle) setTitleDraft(task.title)
  }, [task?.id, task?.title, editingTitle])

  const watch = useApiMutation<void, { watching: boolean }>(
    () => api.post(`/api/tasks/${encodeURIComponent(key)}/watch`),
    ['tasks'],
  )
  const addLink = useApiMutation<{ target: string; type: string }, unknown>(
    (body) => api.post(`/api/tasks/${encodeURIComponent(key)}/links`, body),
    ['tasks'],
  )
  const dropLink = useApiMutation<string, unknown>((id) => api.del(`/api/links/${id}`), ['tasks'])
  const dropAttachment = useApiMutation<string, unknown>(
    (id) => api.del(`/api/attachments/${id}`),
    ['tasks'],
  )
  const removeTask = useApiMutation<void, unknown>(
    () => api.del(`/api/tasks/${encodeURIComponent(key)}`),
    ['tasks', 'board', 'projects'],
  )

  const subtaskProgress = useMemo(() => {
    const list = detail.data?.subtasks ?? []
    if (list.length === 0) return null
    const done = list.filter((s) => s.statusCategory === 'done').length
    return { done, total: list.length, pct: `${Math.round((done / list.length) * 100)}%` }
  }, [detail.data?.subtasks])

  if (detail.isLoading) {
    return (
      <div className="page">
        <div className="skel skel--block" style={{ height: 320 }} />
      </div>
    )
  }

  if (detail.isError || !task) {
    return (
      <div className="page">
        <Empty
          icon="search_off"
          title="Задача не найдена"
          text={`Задачи ${key} нет или у вас нет к ней доступа.`}
          action={
            <button type="button" className="btn btn--primary" onClick={() => nav('/tasks')}>
              К списку задач
            </button>
          }
        />
      </div>
    )
  }

  const data = detail.data!
  const watching = data.watchers.some((w) => w.id === me?.id)
  const editable = can('task.editForeign') || task.authorId === me?.id || task.assigneeId === me?.id

  async function patch(body: Record<string, unknown>, note?: string) {
    try {
      await update.mutateAsync({ key, patch: body })
      setClosing(null)
      if (note) toast('Сохранено', note, 'ok')
    } catch (err) {
      // Закрытие требует причины — сервер прислал варианты, спрашиваем.
      if (err instanceof ApiError && err.status === 422) {
        const payload = err.data as { resolutionRequired?: boolean; resolutions?: ResolutionOption[] }
        if (payload?.resolutionRequired && payload.resolutions?.length) {
          setClosing({ to: String(body.status ?? ''), options: payload.resolutions })
          return
        }
      }
      // Отказ воркфлоу приходит как 422 — показываем причину дословно.
      toastError(err, err instanceof ApiError && err.status === 422 ? 'Переход запрещён' : 'Не сохранилось')
    }
  }

  async function uploadFile(file: File) {
    try {
      await api.upload(`/api/tasks/${encodeURIComponent(key)}/attachments`, file)
      invalidate(['tasks'])
      toast('Файл прикреплён', file.name, 'ok')
    } catch (err) {
      toastError(err, 'Файл не загрузился')
    }
  }

  return (
    <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', minHeight: '100%', gap: 0 }}>
      {/* ── Основная колонка ───────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 40px', minWidth: 0 }}>
        <div className="task__head">
          <TaskKey>{task.key}</TaskKey>
          {task.parentKey && (
            <Link to={`/tasks/${task.parentKey}`} className="task__parent">
              <Icon name="subdirectory_arrow_right" size={14} />
              {task.parentKey}
            </Link>
          )}
          <span className="spacer" style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={watching ? 'btn btn--secondary btn--on' : 'btn btn--secondary'}
              onClick={() =>
                void watch
                  .mutateAsync()
                  .then((r) => toast(r.watching ? 'Вы наблюдаете' : 'Наблюдение снято', task.key, 'info'))
                  .catch(toastError)
              }
            >
              <Icon name={watching ? 'visibility' : 'visibility_off'} size={16} />
              {watching ? 'Наблюдаю' : 'Наблюдать'}
            </button>
            {can('task.delete') && (
              <button
                type="button"
                className="btn btn--icon"
                title="Удалить задачу"
                onClick={() => {
                  if (!window.confirm(`Удалить задачу ${task.key}? Действие необратимо.`)) return
                  void removeTask
                    .mutateAsync()
                    .then(() => {
                      toast('Задача удалена', task.key, 'ok')
                      nav('/tasks')
                    })
                    .catch(toastError)
                }}
              >
                <Icon name="delete" size={17} />
              </button>
            )}
          </span>
        </div>

        {editingTitle ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              className="input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              style={{ height: 36, fontSize: 17, fontWeight: 600 }}
              autoFocus
            />
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                void patch({ title: titleDraft }, 'Заголовок обновлён')
                setEditingTitle(false)
              }}
            >
              Сохранить
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setEditingTitle(false)}>
              Отмена
            </button>
          </div>
        ) : (
          <h1
            className="task__title"
            onDoubleClick={() => editable && setEditingTitle(true)}
            title={editable ? 'Двойной клик — переименовать' : undefined}
          >
            {task.title}
          </h1>
        )}

        {/* ── Переходы статуса ─────────────────────────────────────────── */}
        <div className="task__flow">
          <StatusBadge status={task.status} category={task.statusCategory} />
          <Icon name="arrow_forward" size={15} color="var(--tx3)" />
          {data.transitions.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--tx3)' }}>переходов нет</span>
          )}
          {data.transitions.map((t) => (
            <button
              key={t.id}
              type="button"
              className="btn btn--secondary btn--sm"
              title={t.condition ? `Условие: ${t.condition}` : undefined}
              aria-label={`Перевести в ${t.to}`}
              onClick={() => void patch({ status: t.to }, `${task.status} → ${t.to}`)}
            >
              {t.to}
            </button>
          ))}
        </div>

        {/* ── Описание ─────────────────────────────────────────────────── */}
        <section className="card card--pad" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div className="card__title">Описание</div>
            {editable && !editingDescription && (
              <button
                type="button"
                className="btn btn--link spacer"
                onClick={() => setEditingDescription(true)}
              >
                Редактировать
              </button>
            )}
          </div>

          {editingDescription ? (
            <>
              <textarea
                className="textarea"
                rows={10}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    void patch({ description: draft }, 'Описание обновлено')
                    setEditingDescription(false)
                  }}
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    setDraft(task.description)
                    setEditingDescription(false)
                  }}
                >
                  Отмена
                </button>
              </div>
            </>
          ) : task.description ? (
            <p className="pretty task__description">{task.description}</p>
          ) : (
            <p className="task__description task__description--empty">
              Описания пока нет. {editable && 'Нажмите «Редактировать», чтобы добавить контекст.'}
            </p>
          )}
        </section>

        {/* ── Подзадачи ────────────────────────────────────────────────── */}
        <section className="card card--clip" style={{ marginTop: 12 }}>
          <div className="card__head">
            <div className="card__title">Подзадачи</div>
            {subtaskProgress && (
              <>
                <span className="count-pill">
                  {subtaskProgress.done} / {subtaskProgress.total}
                </span>
                <Progress
                  pct={subtaskProgress.pct}
                  color="var(--ok)"
                  variant="thin"
                  style={{ width: 120, marginLeft: 8 }}
                />
              </>
            )}
          </div>

          {data.subtasks.length === 0 && <div className="task__none">Подзадач нет</div>}

          {data.subtasks.map((s) => (
            <div
              key={s.key}
              className="row"
              style={{ gridTemplateColumns: '92px minmax(0,1fr) 116px 28px 60px', gap: 8 }}
              onClick={() => nav(`/tasks/${s.key}`)}
            >
              <TaskKey>{s.key}</TaskKey>
              <span
                className="ellipsis"
                style={{
                  fontSize: 13,
                  textDecoration: s.statusCategory === 'done' ? 'line-through' : undefined,
                  color: s.statusCategory === 'done' ? 'var(--tx3)' : undefined,
                }}
              >
                {s.title}
              </span>
              <StatusBadge status={s.status} category={s.statusCategory} small />
              <Avatar id={s.who} size="md" />
              <span className="mono" style={{ fontSize: 12, color: dueColor(s.dueState), textAlign: 'right' }}>
                {s.due}
              </span>
            </div>
          ))}
        </section>

        <Checklist taskKey={key} editable={editable} />

        {/* ── Связи ────────────────────────────────────────────────────── */}
        <section className="card card--clip" style={{ marginTop: 12 }}>
          <div className="card__head">
            <div className="card__title">Связанные задачи</div>
            <span className="count-pill">{data.links.length}</span>
            {editable && (
              <button type="button" className="btn btn--link spacer" onClick={() => setLinkOpen(true)}>
                Добавить связь
              </button>
            )}
          </div>

          {data.links.length === 0 && <div className="task__none">Связей нет</div>}

          {data.links.map((l) => (
            <div
              key={l.id}
              className="row"
              style={{ gridTemplateColumns: '150px 92px minmax(0,1fr) 116px 26px', gap: 8 }}
              onClick={() => nav(`/tasks/${l.task.key}`)}
            >
              <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{l.label}</span>
              <TaskKey>{l.task.key}</TaskKey>
              <span className="ellipsis" style={{ fontSize: 13 }}>
                {l.task.title}
              </span>
              <StatusBadge status={l.task.status} category={l.task.statusCategory} small />
              {editable ? (
                <button
                  type="button"
                  className="btn btn--icon-quiet"
                  aria-label="Убрать связь"
                  onClick={(e) => {
                    e.stopPropagation()
                    void dropLink.mutateAsync(l.id).catch(toastError)
                  }}
                >
                  <Icon name="link_off" size={15} />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </section>

        {/* ── Вложения ─────────────────────────────────────────────────── */}
        <section className="card card--clip" style={{ marginTop: 12 }}>
          <div className="card__head">
            <div className="card__title">Вложения</div>
            <span className="count-pill">{data.attachments.length}</span>
            <button type="button" className="btn btn--link spacer" onClick={() => fileRef.current?.click()}>
              Загрузить файл
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadFile(file)
                e.target.value = ''
              }}
            />
          </div>

          {data.attachments.length === 0 && (
            <div className="task__none">Файлов нет — максимум 25 МБ на файл</div>
          )}

          {data.attachments.map((a) => (
            <div
              key={a.id}
              className="row row--static"
              style={{ gridTemplateColumns: '26px minmax(0,1fr) 90px 120px 26px', gap: 8 }}
            >
              <Icon name={a.mime.startsWith('image/') ? 'image' : 'description'} size={17} color="var(--tx2)" />
              <a href={a.url} target="_blank" rel="noreferrer" className="ellipsis task__file">
                {a.filename}
              </a>
              <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                {fileSize(a.size)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{a.byName}</span>
              <button
                type="button"
                className="btn btn--icon-quiet"
                aria-label="Удалить вложение"
                onClick={() => void dropAttachment.mutateAsync(a.id).catch(toastError)}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ))}
        </section>

        {/* ── Обсуждение ───────────────────────────────────────────────── */}
        <section className="card card--clip" style={{ marginTop: 12 }}>
          <div style={{ padding: '0 13px' }}>
            <UnderlineTabs
              options={TABS.map((t) => ({
                ...t,
                count:
                  t.value === 'comments'
                    ? String(comments.data?.length ?? 0)
                    : t.value === 'history'
                      ? String(history.data?.length ?? 0)
                      : undefined,
              }))}
              value={tab}
              onChange={setTab}
            />
          </div>

          <div style={{ padding: '12px 13px' }}>
            {(tab === 'comments' || tab === 'all') && (
              <>
                {(comments.data ?? []).length === 0 && (
                  <div className="task__none" style={{ padding: '4px 0 12px' }}>
                    Комментариев пока нет
                  </div>
                )}
                {(comments.data ?? []).map((c) => (
                  <article key={c.id} className="comment">
                    <Avatar id={c.who} size="lg" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="comment__head">
                        <b>{people.find((p) => p.code === c.who)?.name ?? c.who}</b>
                        <span className="mono">{c.time}</span>
                        {c.edited && <span className="comment__edited">изменён</span>}
                      </div>
                      <p className="pretty comment__text">{c.text}</p>
                    </div>
                  </article>
                ))}
              </>
            )}

            {(tab === 'history' || tab === 'all') && (
              <div className="tl" style={{ marginTop: tab === 'all' ? 14 : 0 }}>
                {(history.data ?? []).map((h) => (
                  <div key={h.id} className="tl__rail">
                    <span className="tl__dot" style={{ background: h.bg, color: h.fg }}>
                      <Icon name={h.icon} size={13} />
                    </span>
                    <span className="tl__line" />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 12 }}>
                        <b style={{ fontWeight: 600 }}>{h.who}</b> {h.what}
                        {h.from && h.to && (
                          <>
                            {' '}
                            <span className="tl__from">{h.from}</span>
                            <Icon name="arrow_forward" size={12} color="var(--tx3)" />
                            <span
                              className="badge badge--sm"
                              style={{ background: h.toBg ?? 'var(--n-bg)', color: h.toFg ?? 'var(--tx2)' }}
                            >
                              {h.to}
                            </span>
                          </>
                        )}
                      </span>
                      <span className="tl__meta">{h.time}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="composer">
            <Avatar id={me?.code ?? null} size="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <textarea
                className="textarea"
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Написать комментарий. Упоминание через @ — например @dmitry"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    if (commentText.trim()) {
                      void addComment
                        .mutateAsync({ key, text: commentText })
                        .then(() => setCommentText(''))
                        .catch(toastError)
                    }
                  }
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--tx3)' }}>⌘↵ отправить</span>
                <button
                  type="button"
                  className="btn btn--primary spacer"
                  disabled={!commentText.trim() || addComment.isPending}
                  onClick={() =>
                    void addComment
                      .mutateAsync({ key, text: commentText })
                      .then(() => setCommentText(''))
                      .catch(toastError)
                  }
                >
                  Отправить
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Панель полей ───────────────────────────────────────────────── */}
      <aside className="task__side">
        <div className="card card--pad">
          <div className="card__title" style={{ marginBottom: 10 }}>
            Поля
          </div>

          <Field label="Исполнитель">
            <div className="select-with-avatar">
              <Avatar id={task.who} size="xs" title={false} />
              <select
                className="select"
                value={task.who ?? ''}
                disabled={!editable}
                onChange={(e) => void patch({ assignee: e.target.value || null }, 'Исполнитель изменён')}
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
          </Field>

          <Field label="Тип">
            <div className="select-with-avatar">
              <Icon name={task.typeIcon} size={16} color={task.typeColor} />
              <select
                className="select"
                value={task.type ?? ''}
                disabled={!editable}
                onChange={(e) => void patch({ type: e.target.value || null }, 'Тип изменён')}
              >
                {(taskTypes.data ?? []).map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          {task.resolution && (
            <Field label="Резолюция">
              <span
                className="badge badge--sm"
                style={{
                  background:
                    task.resolutionKind === 'success'
                      ? 'var(--ok-bg)'
                      : task.resolutionKind === 'rejected'
                        ? 'var(--dang-bg)'
                        : 'var(--n-bg)',
                  color:
                    task.resolutionKind === 'success'
                      ? 'var(--ok)'
                      : task.resolutionKind === 'rejected'
                        ? 'var(--dang)'
                        : 'var(--tx2)',
                }}
              >
                {task.resolution}
              </span>
            </Field>
          )}

          <Field label="Приоритет">
            <div className="select-with-avatar">
              <PriorityChip priority={task.priority} small />
              <select
                className="select"
                value={task.priority}
                disabled={!editable}
                onChange={(e) =>
                  void patch({ priority: PRIORITY_KEY[e.target.value as PriorityName] }, 'Приоритет изменён')
                }
              >
                {PRIORITY_NAMES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Дедлайн">
            <input
              className="input"
              type="date"
              disabled={!editable}
              value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
              onChange={(e) => void patch({ dueDate: e.target.value || null }, 'Дедлайн изменён')}
            />
          </Field>

          <Field label="Оценка, SP">
            <input
              className="input"
              type="number"
              min={0}
              disabled={!editable}
              defaultValue={task.est || ''}
              onBlur={(e) => {
                const value = e.target.value === '' ? null : Number(e.target.value)
                if (value !== (task.est || null)) void patch({ estimate: value }, 'Оценка изменена')
              }}
            />
          </Field>

          <Field label="Проект">
            <select
              className="select"
              value={task.projectId ? task.project : ''}
              disabled={!editable}
              onChange={(e) => void patch({ project: e.target.value || null }, 'Проект изменён')}
            >
              <option value="">Без проекта</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Спринт">
            <select
              className="select"
              value={task.sprintId ? task.sprint : ''}
              disabled={!can('sprint.manage')}
              onChange={(e) => void patch({ sprint: e.target.value || null }, 'Спринт изменён')}
            >
              <option value="">Бэклог</option>
              {(sprints.data ?? [])
                .filter((s) => s.queue === task.queue)
                .map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Очередь">
            <Link to={`/tasks?queue=${task.queue}`} className="task__link mono">
              {task.queue}
            </Link>
          </Field>

          <Field label="Автор">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Avatar id={task.authorCode} size="xs" />
              <span style={{ fontSize: 12 }}>
                {people.find((p) => p.code === task.authorCode)?.name ?? task.authorCode}
              </span>
            </span>
          </Field>

          <Field label="Теги">
            <div className="tagline tagline--tight">
              {task.tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--tx3)' }}>—</span>}
              {task.tags.map((t) => (
                <Link key={t} to={`/tasks?tag=${t}`}>
                  <Tag>{t}</Tag>
                </Link>
              ))}
            </div>
          </Field>
        </div>

        <div className="card card--pad">
          <div className="card__title" style={{ marginBottom: 10 }}>
            Наблюдатели
          </div>
          <div className="task__watchers">
            {data.watchers.map((w) => (
              <span key={w.id} className="task__watcher">
                <Avatar id={w.code} size="md" />
                <span className="ellipsis">{w.name}</span>
                {editable && (
                  <button
                    type="button"
                    className="chip__x"
                    aria-label={`Убрать ${w.name}`}
                    onClick={() =>
                      void api
                        .del(`/api/tasks/${encodeURIComponent(key)}/watchers/${w.code}`)
                        .then(() => invalidate(['tasks']))
                        .catch(toastError)
                    }
                  >
                    <Icon name="close" size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>

          {editable && (
            <select
              className="select"
              style={{ marginTop: 8 }}
              value=""
              onChange={(e) => {
                if (!e.target.value) return
                void api
                  .post(`/api/tasks/${encodeURIComponent(key)}/watchers`, { user: e.target.value })
                  .then(() => invalidate(['tasks']))
                  .catch(toastError)
              }}
            >
              <option value="">+ добавить наблюдателя</option>
              {people
                .filter((p) => p.active && !data.watchers.some((w) => w.id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name}
                  </option>
                ))}
            </select>
          )}
        </div>
      </aside>

      {closing && (
        <ResolutionDialog
          taskKey={task.key}
          status={closing.to}
          options={closing.options}
          busy={update.isPending}
          onClose={() => setClosing(null)}
          onPick={(resolution) =>
            void patch({ status: closing.to, resolution }, `${task.status} → ${closing.to}`)
          }
        />
      )}

      {linkOpen && (
        <LinkDialog
          busy={addLink.isPending}
          onClose={() => setLinkOpen(false)}
          onSave={async (target, type) => {
            try {
              await addLink.mutateAsync({ target, type })
              toast('Связь добавлена', `${task.key} → ${target}`, 'ok')
              setLinkOpen(false)
            } catch (err) {
              toastError(err)
            }
          }}
        />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}

function LinkDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (target: string, type: string) => void
}) {
  const [target, setTarget] = useState('')
  const [type, setType] = useState('relates')

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 440, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Новая связь"
      >
        <div className="modal__head">
          <Icon name="link" size={18} color="var(--ac)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Связать задачи</div>
          <button type="button" className="btn btn--icon-quiet spacer" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="modal__body">
          <label className="label">
            <span>Тип связи</span>
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="relates">связана с</option>
              <option value="blocks">блокирует</option>
              <option value="duplicates">дублирует</option>
              <option value="causes">вызывает</option>
            </select>
          </label>
          <label className="label">
            <span>Ключ задачи</span>
            <input
              className="input mono"
              value={target}
              onChange={(e) => setTarget(e.target.value.toUpperCase())}
              placeholder="VEKHA-138"
              autoFocus
            />
          </label>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--secondary btn--lg spacer" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={busy || !target.trim()}
            onClick={() => onSave(target.trim(), type)}
          >
            Связать
          </button>
        </div>
      </div>
    </div>
  )
}
