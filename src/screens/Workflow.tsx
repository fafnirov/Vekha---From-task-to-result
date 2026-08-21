import { useState } from 'react'
import { Checkbox, Icon, Segmented, StatusBadge, Toggle } from '../components/ui'
import { ST } from '../data/catalog'
import type { StatusName } from '../data/types'
import {
  PERMISSIONS,
  ROLE_COLS,
  RULES,
  TASK_FIELDS,
  TEMPLATES,
  TRANSITIONS,
  WF_EDGES,
  WF_NODES,
} from '../data/workspace'
import { useApp } from '../store/app'

const WF_TABS = [
  { k: 'statuses', label: 'Воркфлоу', icon: 'account_tree' },
  { k: 'fields', label: 'Поля задачи', icon: 'view_list' },
  { k: 'roles', label: 'Роли и права', icon: 'admin_panel_settings' },
  { k: 'auto', label: 'Автоматизации', icon: 'bolt' },
  { k: 'templates', label: 'Шаблоны', icon: 'content_paste' },
] as const

type WfTab = (typeof WF_TABS)[number]['k']

const VIEWS = [
  { value: 'list', label: 'Список' },
  { value: 'schema', label: 'Схема' },
] as const

const FLOW: StatusName[] = ['New', 'Open', 'In Progress', 'Review', 'Testing', 'Done']

const INSPECTOR = [
  {
    title: 'Кто может выполнять',
    items: [
      { label: 'Исполнитель', icon: 'person', fg: 'var(--ac)' },
      { label: 'Лид очереди', icon: 'shield_person', fg: 'var(--ac)' },
    ],
  },
  {
    title: 'Условия',
    items: [
      { label: 'Есть описание', icon: 'description', fg: 'var(--ok)' },
      { label: 'Указана оценка', icon: 'straighten', fg: 'var(--ok)' },
    ],
  },
  {
    title: 'Действия после',
    items: [
      { label: 'Уведомить ревьюера', icon: 'notifications', fg: 'var(--vio)' },
      { label: 'Поставить метку', icon: 'sell', fg: 'var(--vio)' },
    ],
  },
]

const BUILDER_BLOCKS = [
  {
    kind: 'Когда',
    bg: 'var(--ac-soft)',
    fg: 'var(--ac-tx)',
    addLabel: 'триггер',
    rows: [
      { icon: 'bolt', icFg: 'var(--ac)', field: 'событие', value: 'Смена статуса задачи' },
    ],
  },
  {
    kind: 'Если',
    bg: 'var(--warn-bg)',
    fg: 'var(--warn)',
    addLabel: 'условие',
    rows: [
      { icon: 'sync_alt', icFg: 'var(--warn)', field: 'статус', value: '= Review' },
      { icon: 'layers', icFg: 'var(--warn)', field: 'очередь', value: '= VEKHA' },
    ],
  },
  {
    kind: 'То',
    bg: 'var(--ok-bg)',
    fg: 'var(--ok)',
    addLabel: 'действие',
    rows: [
      { icon: 'person_add', icFg: 'var(--ok)', field: 'назначить', value: 'ревьюера команды' },
      { icon: 'notifications', icFg: 'var(--ok)', field: 'уведомить', value: 'наблюдателей' },
    ],
  },
]

export function Workflow() {
  const {
    fieldReq,
    fieldCard,
    toggleField,
    perms,
    togglePerm,
    ruleOn,
    toggleRule,
    toast,
  } = useApp()

  const [tab, setTab] = useState<WfTab>('statuses')
  const [view, setView] = useState<(typeof VIEWS)[number]['value']>('list')
  const [selected, setSelected] = useState<StatusName>('In Progress')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [ruleName, setRuleName] = useState('')

  return (
    <div
      className="split"
      style={{ gridTemplateColumns: '196px minmax(0,1fr)', minHeight: '100%', gap: 0 }}
    >
      <aside className="filter-side" style={{ padding: '14px 10px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 11px' }}>
          <div
            className="mono"
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: 'var(--ac-soft2)',
              color: 'var(--ac)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            VK
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Очередь VEKHA</div>
            <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>128 задач</div>
          </div>
        </div>
        {WF_TABS.map((t) => (
          <button
            key={t.k}
            type="button"
            className={tab === t.k ? 'filter-item filter-item--on' : 'filter-item'}
            onClick={() => setTab(t.k)}
          >
            <Icon name={t.icon} size={16} color={tab === t.k ? 'var(--ac)' : 'var(--tx3)'} />
            {t.label}
          </button>
        ))}
      </aside>

      <div style={{ padding: '14px 16px 30px', minWidth: 0 }}>
        {tab === 'statuses' && (
          <div>
            <div className="page__head" style={{ flexWrap: 'wrap' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Статусы и переходы</div>
              <Segmented options={VIEWS} value={view} onChange={setView} />
              <span className="page__note">
                схема применяется ко всем задачам очереди
              </span>
              <button
                type="button"
                className="btn btn--primary spacer"
                onClick={() => toast('Статус добавлен', 'Новый статус в конце цепочки')}
              >
                <Icon name="add" size={16} />
                Статус
              </button>
            </div>

            {view === 'schema' ? (
              <div
                className="split"
                style={{ gridTemplateColumns: 'minmax(0,1fr) 272px' }}
              >
                <section className="card" style={{ padding: 16, overflowX: 'auto' }}>
                  <div className="wf-canvas">
                    {WF_EDGES.map((e, i) => (
                      <div
                        key={i}
                        className="wf-edge"
                        style={{ left: e.left, top: e.top, width: e.w, height: e.h }}
                      />
                    ))}
                    {WF_NODES.map((n) => {
                      const st = ST[n.id as StatusName]
                      const on = selected === n.id
                      return (
                        <button
                          key={n.id}
                          type="button"
                          className="wf-node"
                          style={{
                            left: n.left,
                            top: n.top,
                            background: on ? st.bg : 'var(--surface)',
                            color: on ? st.fg : 'var(--tx)',
                            borderColor: on ? 'var(--ac)' : 'var(--border)',
                            boxShadow: on ? 'var(--sh2)' : 'var(--sh1)',
                          }}
                          onClick={() => setSelected(n.id as StatusName)}
                        >
                          <span className="badge__dot" style={{ background: st.dot, width: 6, height: 6 }} />
                          {n.label}
                        </button>
                      )
                    })}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      marginTop: 12,
                      fontSize: 11.5,
                      color: 'var(--tx3)',
                    }}
                  >
                    <span>Нажмите на статус, чтобы настроить входящие и исходящие переходы</span>
                    <span className="spacer" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 14, height: 2, background: 'var(--border2)' }} />
                      переход
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 14, height: 2, background: 'var(--ac)' }} />
                      выбранный
                    </span>
                  </div>
                </section>

                <aside className="card card--pad">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
                    <StatusBadge status={selected} dot={false} />
                    <span style={{ fontSize: 12, color: 'var(--tx3)' }}>переход</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {INSPECTOR.map((wi) => (
                      <div key={wi.title}>
                        <div className="vk-eyebrow" style={{ marginBottom: 5 }}>
                          {wi.title}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {wi.items.map((it) => (
                            <span
                              key={it.label}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                height: 23,
                                padding: '0 8px',
                                borderRadius: 6,
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                fontSize: 11.5,
                                color: 'var(--tx2)',
                              }}
                            >
                              <Icon name={it.icon} size={14} color={it.fg} />
                              {it.label}
                            </span>
                          ))}
                          <button
                            type="button"
                            className="btn btn--dashed"
                            style={{ height: 23, padding: '0 7px', fontSize: 11.5 }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            ) : (
              <>
                <section className="card" style={{ padding: 14, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {FLOW.map((s, i) => (
                      <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          className="wf-pill"
                          style={{ background: ST[s].bg, color: ST[s].fg, borderColor: 'transparent' }}
                        >
                          <span
                            className="badge__dot"
                            style={{ background: ST[s].dot, width: 6, height: 6 }}
                          />
                          {s}
                        </span>
                        {i < FLOW.length - 1 && (
                          <Icon name="arrow_forward" size={16} color="var(--border2)" />
                        )}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="card card--clip">
                  <div
                    className="thead"
                    style={{
                      gridTemplateColumns: '28px 150px 172px minmax(0,1fr) 132px 30px',
                      gap: 10,
                      padding: '0 13px',
                    }}
                  >
                    <span />
                    <span>Из статуса</span>
                    <span>В статус</span>
                    <span>Условие</span>
                    <span>Кто может</span>
                    <span />
                  </div>
                  {TRANSITIONS.map((tr, i) => (
                    <div
                      key={i}
                      className="row row--static"
                      style={{
                        gridTemplateColumns: '28px 150px 172px minmax(0,1fr) 132px 30px',
                        gap: 10,
                        height: 38,
                      }}
                    >
                      <Icon name="drag_indicator" size={16} color="var(--border2)" />
                      <StatusBadge status={tr.from} dot={false} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Icon name="arrow_forward" size={15} color="var(--tx3)" />
                        <StatusBadge status={tr.to} dot={false} />
                      </span>
                      <span className="ellipsis" style={{ fontSize: 12, color: 'var(--tx2)' }}>
                        {tr.cond}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{tr.role}</span>
                      <button
                        type="button"
                        className="btn btn--icon-quiet"
                        style={{ width: 20, height: 20, justifySelf: 'center' }}
                        aria-label="Изменить переход"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                    </div>
                  ))}
                </section>
              </>
            )}
          </div>
        )}

        {tab === 'fields' && (
          <div>
            <div className="page__head">
              <div style={{ fontSize: 15, fontWeight: 600 }}>Поля задачи</div>
              <button
                type="button"
                className="btn btn--primary spacer"
                onClick={() => toast('Поле добавлено', 'Настройте тип и обязательность')}
              >
                <Icon name="add" size={16} />
                Поле
              </button>
            </div>
            <section className="card card--clip">
              <div
                className="thead"
                style={{
                  gridTemplateColumns: '28px minmax(0,1fr) 148px 116px 96px 84px',
                  gap: 10,
                  padding: '0 13px',
                }}
              >
                <span />
                <span>Поле</span>
                <span>Тип</span>
                <span>Обязательное</span>
                <span>В карточке</span>
                <span>Экран</span>
              </div>
              {TASK_FIELDS.map((tf) => (
                <div
                  key={tf.id}
                  className="row row--static"
                  style={{
                    gridTemplateColumns: '28px minmax(0,1fr) 148px 116px 96px 84px',
                    gap: 10,
                    height: 38,
                  }}
                >
                  <Icon name="drag_indicator" size={16} color="var(--border2)" />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name={tf.icon} size={16} color="var(--tx3)" />
                    <span style={{ fontSize: 12.5 }}>{tf.label}</span>
                  </span>
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
                    {tf.type}
                  </span>
                  <Toggle
                    on={Boolean(fieldReq[tf.id])}
                    onClick={() => toggleField(tf.id, 'req')}
                    label={`${tf.label}: обязательное поле`}
                  />
                  <Toggle
                    on={Boolean(fieldCard[tf.id])}
                    onClick={() => toggleField(tf.id, 'card')}
                    label={`${tf.label}: показывать в карточке`}
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{tf.screen}</span>
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === 'roles' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 11 }}>
              Роли и права доступа
            </div>
            <section className="card card--clip">
              <div
                className="thead"
                style={{
                  gridTemplateColumns: `minmax(0,1fr) repeat(${ROLE_COLS.length},86px)`,
                  height: 34,
                  padding: '0 13px',
                }}
              >
                <span>Право</span>
                {ROLE_COLS.map((rc) => (
                  <span key={rc} style={{ textAlign: 'center' }}>
                    {rc}
                  </span>
                ))}
              </div>
              {PERMISSIONS.map((pm) => (
                <div
                  key={pm.id}
                  className="row row--static"
                  style={{
                    gridTemplateColumns: `minmax(0,1fr) repeat(${ROLE_COLS.length},86px)`,
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12.5 }}>{pm.label}</span>
                  {(perms[pm.id] ?? pm.cells).map((cell, i) => (
                    <span key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                      <Checkbox
                        small
                        on={cell}
                        onClick={() => togglePerm(pm.id, i)}
                        label={`${pm.label} — ${ROLE_COLS[i]}`}
                      />
                    </span>
                  ))}
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === 'auto' && (
          <div>
            <div className="page__head">
              <div style={{ fontSize: 15, fontWeight: 600 }}>Автоматизации</div>
              <span className="page__note">триггер → условие → действие</span>
              <button
                type="button"
                className="btn btn--primary spacer"
                onClick={() => setBuilderOpen(true)}
              >
                <Icon name="add" size={16} />
                Правило
              </button>
            </div>

            {builderOpen && (
              <div
                className="card"
                style={{
                  borderColor: 'var(--ac-soft2)',
                  boxShadow: 'var(--sh2)',
                  padding: '13px 14px',
                  marginBottom: 10,
                  animation: 'vk-pop 170ms cubic-bezier(.2,.8,.3,1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
                  <Icon name="bolt" size={17} color="var(--ac)" />
                  <input
                    className="input"
                    style={{ flex: 1, height: 30 }}
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="Название правила"
                  />
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setBuilderOpen(false)}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      setBuilderOpen(false)
                      toast('Правило сохранено', ruleName.trim() || 'Без названия')
                      setRuleName('')
                    }}
                  >
                    Сохранить
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {BUILDER_BLOCKS.map((bb) => (
                    <div
                      key={bb.kind}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '74px minmax(0,1fr)',
                        gap: 10,
                        alignItems: 'start',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 24,
                          borderRadius: 6,
                          background: bb.bg,
                          color: bb.fg,
                          fontSize: 11.5,
                          fontWeight: 600,
                        }}
                      >
                        {bb.kind}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {bb.rows.map((br) => (
                          <div
                            key={br.field}
                            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
                          >
                            <Icon name="drag_indicator" size={15} color="var(--border2)" />
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                flex: 1,
                                minWidth: 0,
                                height: 30,
                                padding: '0 10px',
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                borderRadius: 7,
                                fontSize: 12.5,
                              }}
                            >
                              <Icon name={br.icon} size={15} color={br.icFg} />
                              <span style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
                                {br.field}
                              </span>
                              <span className="ellipsis" style={{ fontWeight: 500 }}>
                                {br.value}
                              </span>
                              <Icon
                                name="expand_more"
                                size={15}
                                color="var(--tx3)"
                                className="spacer"
                              />
                            </span>
                            <button
                              type="button"
                              className="btn btn--icon-quiet"
                              style={{ width: 20, height: 20 }}
                              aria-label="Удалить строку"
                            >
                              <Icon name="close" size={16} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn--dashed btn--sm"
                          style={{ width: 'fit-content' }}
                        >
                          <Icon name="add" size={14} />
                          {bb.addLabel}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {RULES.map((r) => {
                const on = Boolean(ruleOn[r.id])
                return (
                  <div
                    key={r.id}
                    className="card"
                    style={{ padding: '12px 13px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Icon name={r.icon} size={17} color={r.iconFg} />
                      <div style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0 }}>
                        {r.name}
                      </div>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
                        {r.runs}
                      </span>
                      <Toggle
                        on={on}
                        onClick={() => {
                          toggleRule(r.id)
                          toast(
                            on ? 'Правило выключено' : 'Правило включено',
                            r.name,
                            on ? 'warn' : 'ok',
                          )
                        }}
                        label={r.name}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        marginTop: 9,
                        flexWrap: 'wrap',
                        opacity: on ? 1 : 0.5,
                        transition: 'opacity 180ms ease',
                      }}
                    >
                      <span
                        className="badge"
                        style={{ background: 'var(--ac-soft)', color: 'var(--ac-tx)', height: 24 }}
                      >
                        <Icon name="bolt" size={14} />
                        {r.trigger}
                      </span>
                      <Icon name="arrow_forward" size={15} color="var(--border2)" />
                      <span
                        className="badge"
                        style={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          color: 'var(--tx2)',
                          height: 24,
                        }}
                      >
                        {r.cond}
                      </span>
                      <Icon name="arrow_forward" size={15} color="var(--border2)" />
                      <span
                        className="badge"
                        style={{ background: 'var(--ok-bg)', color: 'var(--ok)', height: 24 }}
                      >
                        {r.action}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'templates' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 11 }}>
              Шаблоны задач
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(268px,1fr))',
                gap: 10,
              }}
            >
              {TEMPLATES.map((tp) => (
                <div
                  key={tp.name}
                  className="card card--hover"
                  style={{ padding: '12px 13px' }}
                  onClick={() => toast('Шаблон применён', tp.name, 'info')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name={tp.icon} size={17} color="var(--ac)" />
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{tp.name}</div>
                  </div>
                  <div
                    className="pretty"
                    style={{
                      fontSize: 11.5,
                      color: 'var(--tx2)',
                      marginTop: 7,
                      lineHeight: 1.5,
                    }}
                  >
                    {tp.note}
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
                    {tp.tags.map((tg) => (
                      <span
                        key={tg}
                        className="tag"
                        style={{ height: 19, padding: '0 7px' }}
                      >
                        {tg}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
