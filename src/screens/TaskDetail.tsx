import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Checkbox,
  Icon,
  Progress,
  StatusBadge,
  TaskKey,
  UnderlineTabs,
} from '../components/ui'
import {
  PEOPLE,
  ST,
  STATUS_FLOW,
  dueColor,
  priorityStyle,
  statusStyle,
} from '../data/catalog'
import { findTask } from '../data/tasks'
import { BASE_COMMENTS, EVENT_HISTORY, TASK_HISTORY, type Comment } from '../data/feed'
import type { PersonId, StatusName } from '../data/types'
import { useApp } from '../store/app'

const TABS = [
  { value: 'comments', label: 'Комментарии' },
  { value: 'history', label: 'История' },
  { value: 'all', label: 'Все события' },
  { value: 'links', label: 'Связанные' },
] as const

type TabValue = (typeof TABS)[number]['value']

const CHECKLIST = [
  { id: 'c1', key: 'VEKHA-143', text: 'Карта разделов и правила группировки', who: 'AK' },
  { id: 'c2', key: 'VEKHA-144', text: 'Макет полного состояния меню', who: 'MN' },
  { id: 'c3', key: 'VEKHA-145', text: 'Свёрнутое состояние и поиск по разделам', who: 'MN' },
  { id: 'c4', key: 'VEKHA-146', text: 'Правила видимости по ролям', who: 'PG' },
] as const

const ATTACHMENTS = [
  { name: 'nav-map-v3.fig', size: '2.4 МБ', kind: 'FIGMA' },
  { name: 'sidebar-states.png', size: '860 КБ', kind: 'PNG 1440×900' },
  { name: 'research-notes.pdf', size: '340 КБ', kind: 'PDF · 6 стр.' },
]

const LINKED = [
  { key: 'VEKHA-138', rel: 'блокирует' },
  { key: 'VEKHA-129', rel: 'связана' },
  { key: 'MOB-84', rel: 'дублирует' },
]

const RICH_TOOLS = [
  { icon: 'format_bold', title: 'Жирный' },
  { icon: 'format_italic', title: 'Курсив' },
  { icon: 'format_h1', title: 'Заголовок', sep: true },
  { icon: 'format_list_bulleted', title: 'Список' },
  { icon: 'format_list_numbered', title: 'Нумерованный список' },
  { icon: 'checklist', title: 'Чек-лист', sep: true },
  { icon: 'code', title: 'Код' },
  { icon: 'format_quote', title: 'Цитата' },
  { icon: 'link', title: 'Ссылка' },
  { icon: 'table', title: 'Таблица' },
]

const EDITOR_TOOLS = [
  { icon: 'format_bold', title: 'Жирный' },
  { icon: 'format_italic', title: 'Курсив' },
  { icon: 'code', title: 'Код' },
  { icon: 'alternate_email', title: 'Упоминание' },
  { icon: 'attach_file', title: 'Вложение' },
]

const WATCHERS: PersonId[] = ['AK', 'DS', 'MN', 'PG']

export function TaskDetail() {
  const { key = 'VEKHA-142' } = useParams()
  const nav = useNavigate()
  const { statusOf, setStatus, checks, toggleCheck, toast } = useApp()

  const raw = findTask(key)
  const status = statusOf(raw.key)
  const st = statusStyle(status)
  const pr = priorityStyle(raw.priority)

  const [tab, setTab] = useState<TabValue>('comments')
  const [statusMenu, setStatusMenu] = useState(false)
  const [taskMenu, setTaskMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [extra, setExtra] = useState<Comment[]>([])

  const doneCount = CHECKLIST.filter((c) => checks[c.id]).length
  const nextStatus: StatusName = useMemo(() => {
    const i = STATUS_FLOW.indexOf(status)
    return STATUS_FLOW[Math.min(STATUS_FLOW.length - 1, i < 0 ? 2 : i + 1)]
  }, [status])

  const comments = [...BASE_COMMENTS, ...extra]
  const history = tab === 'all' ? [...EVENT_HISTORY, ...TASK_HISTORY] : TASK_HISTORY

  const addComment = () => {
    const text = draft.trim()
    if (!text) {
      toast('Пустой комментарий', 'Введите текст перед отправкой', 'warn')
      return
    }
    setExtra([
      ...extra,
      { id: `n${extra.length}`, who: 'AK', time: 'только что', text, fresh: true },
    ])
    setDraft('')
    toast('Комментарий добавлен', 'Уведомлены 4 наблюдателя')
  }

  const fieldGroups = [
    {
      title: 'Основное',
      items: [
        { label: 'Статус', kind: 'badge' as const, value: status, bg: st.bg, fg: st.fg },
        {
          label: 'Приоритет',
          kind: 'badge' as const,
          value: raw.priority,
          bg: pr.bg,
          fg: pr.fg,
          icon: pr.icon,
        },
        {
          label: 'Исполнитель',
          kind: 'avatar' as const,
          value: PEOPLE[raw.who].name,
          who: raw.who,
        },
        { label: 'Автор', kind: 'avatar' as const, value: 'Анна Ковалёва', who: 'AK' as PersonId },
      ],
    },
    {
      title: 'Планирование',
      items: [
        { label: 'Очередь', kind: 'mono' as const, value: `${raw.queue} · Платформа` },
        { label: 'Проект', kind: 'text' as const, value: raw.project },
        { label: 'Спринт', kind: 'text' as const, value: raw.sprint },
        {
          label: 'Дедлайн',
          kind: 'mono' as const,
          value: raw.due,
          fg: dueColor(raw.dueState),
        },
        { label: 'Оценка', kind: 'mono' as const, value: `${raw.est} SP` },
        { label: 'Затрачено', kind: 'mono' as const, value: '3ч 40м' },
      ],
    },
    {
      title: 'Дополнительно',
      items: [
        { label: 'Компонент', kind: 'text' as const, value: 'Навигация' },
        { label: 'Связи', kind: 'text' as const, value: 'блокирует 2 задачи' },
        { label: 'Вложения', kind: 'text' as const, value: '3 файла' },
      ],
    },
  ]

  return (
    <div
      className="split"
      style={{
        gridTemplateColumns: 'minmax(0,1fr) 296px',
        minHeight: '100%',
        gap: 0,
      }}
    >
      <div style={{ padding: '16px 18px 32px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <button
            type="button"
            className="btn btn--icon btn--sm"
            style={{ width: 26 }}
            title="Назад к списку"
            onClick={() => nav('/tasks')}
          >
            <Icon name="arrow_back" size={16} />
          </button>
          <span
            className="mono"
            style={{ fontSize: 12.5, color: 'var(--ac-tx)', fontWeight: 500 }}
          >
            {raw.key}
          </span>
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>
            создана 12 августа · Анна Ковалёва
          </span>
          <div className="spacer" style={{ display: 'flex', gap: 6, position: 'relative' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => toast('Ссылка скопирована', `vekha.app/${raw.key}`)}
            >
              <Icon name="link" size={16} />
              Ссылка
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: st.bg, borderColor: 'transparent', color: st.fg, fontWeight: 500 }}
              onClick={() => {
                setStatusMenu(!statusMenu)
                setTaskMenu(false)
              }}
            >
              <span className="badge__dot" style={{ background: st.dot, width: 6, height: 6 }} />
              {status}
              <Icon name="expand_more" size={15} />
            </button>
            <button
              type="button"
              className="btn btn--icon"
              onClick={() => {
                setTaskMenu(!taskMenu)
                setStatusMenu(false)
              }}
              aria-label="Действия с задачей"
            >
              <Icon name="more_horiz" size={17} />
            </button>

            {statusMenu && (
              <div className="menu" style={{ top: 32, right: 34, width: 190 }}>
                <div className="vk-eyebrow" style={{ padding: '5px 8px 6px' }}>
                  Перевести в
                </div>
                {(['Open', 'In Progress', 'Review', 'Testing', 'Done', 'Blocked'] as StatusName[]).map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      className="menu__item"
                      style={{ background: s === status ? 'var(--surface2)' : undefined }}
                      onClick={() => {
                        setStatus(raw.key, s)
                        setStatusMenu(false)
                        toast('Статус обновлён', `${raw.key} → ${s}`, s === 'Done' ? 'ok' : 'info')
                      }}
                    >
                      <span
                        className="badge__dot"
                        style={{ background: ST[s].dot, width: 6, height: 6 }}
                      />
                      <span style={{ flex: 1 }}>{s}</span>
                      {s === status && <Icon name="check" size={15} color="var(--ac)" />}
                    </button>
                  ),
                )}
              </div>
            )}

            {taskMenu && (
              <div className="menu" style={{ top: 32, right: 0, width: 196 }}>
                <button
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    setTaskMenu(false)
                    toast('Задача клонирована', 'Создана VEKHA-147')
                  }}
                >
                  <Icon name="content_copy" size={16} />
                  Клонировать
                </button>
                <button
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    setTaskMenu(false)
                    toast('Перенос', 'Выберите очередь в диалоге', 'info')
                  }}
                >
                  <Icon name="move_down" size={16} />
                  Перенести в очередь
                </button>
                <button
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    setTaskMenu(false)
                    setTab('links')
                  }}
                >
                  <Icon name="link" size={16} />
                  Связать задачу
                </button>
                <button
                  type="button"
                  className="menu__item"
                  style={{ color: 'var(--dang)' }}
                  onClick={() => {
                    setTaskMenu(false)
                    toast('Удаление отклонено', 'Нет прав на удаление в очереди VEKHA', 'err')
                  }}
                >
                  <Icon name="delete" size={16} color="var(--dang)" />
                  Удалить
                </button>
              </div>
            )}
          </div>
        </div>

        <h1
          className="pretty"
          style={{ margin: '0 0 12px', fontSize: 22, lineHeight: 1.25, letterSpacing: '-0.02em' }}
        >
          {raw.title}
        </h1>

        <section className="card card--pad" style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Icon name="description" size={16} color="var(--tx3)" />
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Описание</div>
            <button
              type="button"
              className="btn btn--link spacer"
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Просмотр' : 'Редактировать'}
            </button>
          </div>
          {editing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '5px 6px',
                marginBottom: 8,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                animation: 'vk-pop 150ms cubic-bezier(.2,.8,.3,1)',
                flexWrap: 'wrap',
              }}
            >
              {RICH_TOOLS.map((rt) => (
                <span key={rt.icon} style={{ display: 'contents' }}>
                  <button
                    type="button"
                    className="btn btn--icon-quiet"
                    title={rt.title}
                    aria-label={rt.title}
                  >
                    <Icon name={rt.icon} size={16} />
                  </button>
                  {rt.sep && (
                    <span
                      style={{
                        width: 1,
                        height: 16,
                        background: 'var(--border)',
                        margin: '0 3px',
                      }}
                    />
                  )}
                </span>
              ))}
              <span className="spacer" style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setEditing(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => {
                    setEditing(false)
                    toast('Описание сохранено', 'Версия добавлена в историю изменений')
                  }}
                >
                  Сохранить
                </button>
              </span>
            </div>
          )}
          <div
            className="pretty"
            style={{
              fontSize: 13,
              color: 'var(--tx2)',
              lineHeight: 1.6,
              padding: editing ? '10px 11px' : 0,
              border: `1px solid ${editing ? 'var(--ac)' : 'transparent'}`,
              borderRadius: 8,
              transition: 'border-color 160ms ease',
            }}
          >
            <p style={{ margin: '0 0 8px' }}>
              Текущая навигация выросла исторически: разделы дублируют друг друга,
              вложенность до четырёх уровней, часть путей ведёт в тупик. Нужно свести
              структуру к восьми основным разделам и вынести управление в отдельную группу.
            </p>
            <p style={{ margin: '0 0 8px' }}>
              Ожидаемый результат — новая карта навигации, макеты левого меню в трёх
              состояниях (полное, свёрнутое, поиск) и правила для активного состояния.
            </p>
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '9px 11px',
                background: 'var(--ac-soft)',
                borderRadius: 8,
                color: 'var(--ac-tx)',
                fontSize: 12.5,
              }}
            >
              <Icon name="info" size={17} />
              <span>
                Блокирует VEKHA-138 и VEKHA-129. Согласовать с командой Mobile до 25
                августа.
              </span>
            </div>
          </div>
        </section>

        <section className="card card--pad" style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <Icon name="checklist" size={16} color="var(--tx3)" />
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Подзадачи</div>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
              {doneCount}/{CHECKLIST.length}
            </span>
            <Progress
              pct={`${Math.round((doneCount / CHECKLIST.length) * 100)}%`}
              color="var(--ok)"
              variant="thin"
              style={{ flex: 1, maxWidth: 140, marginLeft: 4 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {CHECKLIST.map((c) => {
              const on = Boolean(checks[c.id])
              return (
                <div
                  key={c.id}
                  onClick={() => toggleCheck(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    height: 32,
                    padding: '0 6px',
                    borderRadius: 7,
                    cursor: 'pointer',
                  }}
                >
                  <Checkbox
                    on={on}
                    tone="ok"
                    label={c.text}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCheck(c.id)
                    }}
                  />
                  <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                    {c.key}
                  </span>
                  <span
                    className="ellipsis"
                    style={{
                      fontSize: 12.5,
                      flex: 1,
                      color: on ? 'var(--tx3)' : 'var(--tx)',
                      textDecoration: on ? 'line-through' : 'none',
                    }}
                  >
                    {c.text}
                  </span>
                  <Avatar id={c.who} size="xs" />
                </div>
              )
            })}
          </div>
          <button
            type="button"
            className="btn btn--dashed"
            style={{ marginTop: 6 }}
            onClick={() => toast('Подзадача создана', 'VEKHA-147 добавлена в чек-лист')}
          >
            <Icon name="add" size={15} />
            Добавить подзадачу
          </button>
        </section>

        <section className="card card--pad" style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <Icon name="attach_file" size={16} color="var(--tx3)" />
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Вложения</div>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
              {ATTACHMENTS.length}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
              gap: 8,
            }}
          >
            {ATTACHMENTS.map((at) => (
              <div key={at.name} className="att">
                <div className="att__thumb">
                  <span className="mono" style={{ fontSize: 10, color: 'var(--tx3)' }}>
                    {at.kind}
                  </span>
                </div>
                <div style={{ padding: '7px 8px' }}>
                  <div className="ellipsis" style={{ fontSize: 11.5 }}>
                    {at.name}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
                    {at.size}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card card--clip">
          <div style={{ padding: '0 12px', borderBottom: '1px solid var(--border)' }}>
            <UnderlineTabs
              options={TABS.map((t) => ({
                value: t.value,
                label: t.label,
                count:
                  t.value === 'comments'
                    ? String(comments.length)
                    : t.value === 'history'
                      ? String(TASK_HISTORY.length)
                      : t.value === 'all'
                        ? String(TASK_HISTORY.length + EVENT_HISTORY.length)
                        : String(LINKED.length),
              }))}
              value={tab}
              onChange={setTab}
              height={38}
            />
          </div>

          {tab === 'comments' && (
            <div style={{ padding: '13px 14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {comments.map((c) => {
                  const p = PEOPLE[c.who]
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '26px minmax(0,1fr)',
                        gap: 10,
                        animation: c.fresh
                          ? 'vk-row 240ms cubic-bezier(.2,.8,.3,1)'
                          : undefined,
                      }}
                    >
                      <span className="av av--lg" style={{ background: p.bg, color: p.fg }}>
                        {p.who}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{c.time}</span>
                          {c.badge && (
                            <span
                              className="badge badge--sm"
                              style={{ background: 'var(--ac-soft)', color: 'var(--ac-tx)' }}
                            >
                              {c.badge}
                            </span>
                          )}
                        </div>
                        <div
                          className="pretty"
                          style={{
                            fontSize: 12.5,
                            color: 'var(--tx2)',
                            lineHeight: 1.55,
                            marginTop: 3,
                          }}
                        >
                          {c.text}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                          <button type="button" className="btn btn--link" style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
                            Ответить
                          </button>
                          <button type="button" className="btn btn--link" style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
                            Цитировать
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '26px minmax(0,1fr)',
                  gap: 10,
                  marginTop: 14,
                  paddingTop: 13,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <Avatar id="AK" size="lg" />
                <div>
                  <div
                    className="composer"
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'var(--surface2)',
                    }}
                  >
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Комментарий, @упоминание или ссылка на задачу…"
                      rows={2}
                      style={{
                        width: '100%',
                        border: 0,
                        outline: 'none',
                        background: 'transparent',
                        resize: 'vertical',
                        padding: '9px 10px',
                        fontSize: 12.5,
                        color: 'var(--tx)',
                        fontFamily: 'inherit',
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 8px',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      {EDITOR_TOOLS.map((et) => (
                        <button
                          key={et.icon}
                          type="button"
                          className="btn btn--icon-quiet"
                          style={{ width: 24, height: 24 }}
                          title={et.title}
                          aria-label={et.title}
                        >
                          <Icon name={et.icon} size={16} />
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn btn--primary btn--sm spacer"
                        onClick={addComment}
                      >
                        Отправить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(tab === 'history' || tab === 'all') && (
            <div style={{ padding: '13px 14px' }}>
              {history.map((h, i) => (
                <div key={i} className="tl">
                  <div className="tl__rail">
                    <div className="tl__dot" style={{ background: h.bg, color: h.fg }}>
                      <Icon name={h.icon} size={14} />
                    </div>
                    {i < history.length - 1 && <div className="tl__line" />}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>
                      <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{h.who}</span>{' '}
                      {h.what}
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}
                    >
                      {h.from && (
                        <>
                          <span
                            className="badge badge--sm"
                            style={{ background: 'var(--n-bg)', color: 'var(--tx2)' }}
                          >
                            {h.from}
                          </span>
                          <Icon name="arrow_forward" size={14} color="var(--tx3)" />
                        </>
                      )}
                      {h.to && (
                        <span
                          className="badge badge--sm"
                          style={{ background: h.toBg, color: h.toFg }}
                        >
                          {h.to}
                        </span>
                      )}
                      <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
                        {h.time}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'links' && (
            <div style={{ padding: '6px 0' }}>
              {LINKED.map((lk) => {
                const t = findTask(lk.key)
                return (
                  <div
                    key={lk.key}
                    className="row"
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '0 14px',
                      height: 38,
                    }}
                    onClick={() => nav(`/tasks/${lk.key}`)}
                  >
                    <span
                      style={{
                        width: 84,
                        fontSize: 11,
                        color: 'var(--tx3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {lk.rel}
                    </span>
                    <span style={{ width: 82 }}>
                      <TaskKey>{t.key}</TaskKey>
                    </span>
                    <span className="ellipsis" style={{ flex: 1, fontSize: 12.5 }}>
                      {t.title}
                    </span>
                    <StatusBadge status={statusOf(t.key)} dot={false} small />
                    <Avatar id={t.who} />
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <aside className="sticky-aside" style={{ padding: '16px 16px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Детали</div>
          <button
            type="button"
            className="btn btn--icon-quiet spacer"
            title="Свернуть панель"
            aria-label="Свернуть панель"
          >
            <Icon name="right_panel_close" size={17} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fieldGroups.map((g) => (
            <div key={g.title}>
              <div className="vk-eyebrow" style={{ marginBottom: 3 }}>
                {g.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {g.items.map((f) => (
                  <div key={f.label} className="detail-row" title="Нажмите, чтобы изменить">
                    <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{f.label}</span>
                    {f.kind === 'avatar' && (
                      <span
                        style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}
                      >
                        <Avatar id={f.who} size="xs" title={false} />
                        <span className="ellipsis" style={{ fontSize: 12 }}>
                          {f.value}
                        </span>
                      </span>
                    )}
                    {f.kind === 'badge' && (
                      <span
                        className="badge"
                        style={{ background: f.bg, color: f.fg }}
                      >
                        {f.icon && <Icon name={f.icon} size={15} />}
                        {f.value}
                      </span>
                    )}
                    {f.kind === 'text' && (
                      <span className="ellipsis" style={{ fontSize: 12 }}>
                        {f.value}
                      </span>
                    )}
                    {f.kind === 'mono' && (
                      <span
                        className="ellipsis mono"
                        style={{ fontSize: 12, color: f.fg ?? 'var(--tx)' }}
                      >
                        {f.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="vk-sep" style={{ margin: '12px 0' }} />
        <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginBottom: 7 }}>Теги</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {raw.tags.map((t) => (
            <span
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 22,
                padding: '0 8px',
                borderRadius: 6,
                background: 'var(--n-bg)',
                color: 'var(--tx2)',
                fontSize: 11.5,
              }}
            >
              {t}
            </span>
          ))}
          <button
            type="button"
            className="btn btn--dashed"
            style={{ height: 22, padding: '0 7px', fontSize: 11.5 }}
            onClick={() => toast('Тег добавлен', 'navigation', 'info')}
          >
            + тег
          </button>
        </div>

        <div className="vk-sep" style={{ margin: '12px 0' }} />
        <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginBottom: 7 }}>
          Наблюдатели
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="av-stack">
            {WATCHERS.map((w) => (
              <Avatar key={w} id={w} size="md" />
            ))}
          </span>
          <button
            type="button"
            className="av-add"
            aria-label="Добавить наблюдателя"
            onClick={() => toast('Наблюдатель добавлен', 'Елена Лапина')}
          >
            <Icon name="add" size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            style={{ justifyContent: 'center' }}
            onClick={() => {
              setStatus(raw.key, nextStatus)
              toast(
                'Статус обновлён',
                `${raw.key} → ${nextStatus}`,
                nextStatus === 'Done' ? 'ok' : 'info',
              )
            }}
          >
            <Icon name="arrow_forward" size={16} />
            Перевести в {nextStatus}
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--lg"
            style={{ justifyContent: 'center', background: 'var(--surface2)' }}
            onClick={() => toast('Таймер запущен', `Время списывается на ${raw.key}`, 'info')}
          >
            <Icon name="timer" size={16} />
            Списать время
          </button>
        </div>
      </aside>
    </div>
  )
}
