import { useState } from 'react'
import { Icon } from './ui'

/**
 * Спрашивает причину закрытия задачи.
 *
 * Без резолюции статус «Done» не отличает решённую задачу от отменённой:
 * в отчётах обе выглядят одинаково успешными. Сервер отвечает 422 и
 * присылает список вариантов, а диалог показывает их пользователю.
 */

export interface ResolutionOption {
  id: string
  name: string
  kind: string
}

const KIND_TONE: Record<string, { icon: string; color: string }> = {
  success: { icon: 'check_circle', color: 'var(--ok)' },
  neutral: { icon: 'remove_circle', color: 'var(--tx2)' },
  rejected: { icon: 'cancel', color: 'var(--dang)' },
}

export function ResolutionDialog({
  taskKey,
  status,
  options,
  busy,
  onClose,
  onPick,
}: {
  taskKey: string
  status: string
  options: ResolutionOption[]
  busy: boolean
  onClose: () => void
  onPick: (resolution: string) => void
}) {
  const [picked, setPicked] = useState(options[0]?.name ?? '')

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 440, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Причина закрытия"
      >
        <div className="modal__head">
          <Icon name="task_alt" size={18} color="var(--ok)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Закрыть задачу</div>
          <span className="count-pill mono">{taskKey}</span>
          <button
            type="button"
            className="btn btn--icon-quiet spacer"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="modal__body">
          <p className="report__hint" style={{ margin: 0 }}>
            Переход в «{status}» требует причины: по ней потом видно, что было
            сделано, а что отменено.
          </p>

          <div className="resolutions">
            {options.map((o) => {
              const tone = KIND_TONE[o.kind] ?? KIND_TONE.neutral
              const on = picked === o.name
              return (
                <button
                  key={o.id}
                  type="button"
                  className={on ? 'resolution resolution--on' : 'resolution'}
                  onClick={() => setPicked(o.name)}
                >
                  <Icon name={tone.icon} size={17} color={tone.color} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{o.name}</span>
                  {on && <Icon name="check" size={16} color="var(--ac)" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--secondary btn--lg spacer" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={busy || !picked}
            onClick={() => onPick(picked)}
          >
            Закрыть задачу
          </button>
        </div>
      </div>
    </div>
  )
}
