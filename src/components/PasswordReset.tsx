import { useState } from 'react'
import { Icon } from './ui'

/**
 * Сброс пароля участнику: подтверждение и показ временного пароля.
 *
 * Два шага живут в одном окне намеренно. Системный `window.confirm`
 * выглядит чужеродно и на части площадок подавляется браузером — то
 * есть действие тихо не срабатывает.
 *
 * Пароль виден ровно один раз: в базе лежит только хеш, подсмотреть его
 * повторно нельзя, можно лишь выпустить новый. Поэтому второй шаг
 * закрывается сознательным «Готово», а не кликом мимо окна.
 */
export function PasswordReset({
  name,
  email,
  password,
  busy,
  onConfirm,
  onClose,
}: {
  name: string
  email: string
  /** Пока null — окно спрашивает подтверждение. */
  password: string | null
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const done = password !== null

  return (
    <div className="scrim" onClick={done ? undefined : onClose}>
      <div
        className="modal"
        style={{ width: 420, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={done ? 'Временный пароль' : 'Сброс пароля'}
      >
        <div className="modal__head">
          <Icon name="key" size={18} color="var(--warn)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {done ? 'Пароль сброшен' : 'Сбросить пароль'}
          </div>
        </div>

        <div className="modal__body">
          {done ? (
            <>
              <p className="report__hint" style={{ margin: 0 }}>
                Временный пароль для <b>{name}</b> ({email}). Передайте его лично —
                письма приложение не отправляет. Показывается один раз.
              </p>

              <div className="secret">
                <code className="secret__value">{password}</code>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(password)
                      .then(() => setCopied(true))
                      .catch(() => setCopied(false))
                  }}
                >
                  <Icon name={copied ? 'check' : 'content_copy'} size={15} />
                  {copied ? 'Скопировано' : 'Копировать'}
                </button>
              </div>

              <p className="report__hint" style={{ margin: 0 }}>
                Попросите сменить его в «Профиль и пароль» после первого входа.
              </p>
            </>
          ) : (
            <p className="report__hint" style={{ margin: 0 }}>
              Текущий пароль <b>{name}</b> ({email}) перестанет работать. Взамен
              будет выдан временный — вы увидите его один раз и передадите лично.
            </p>
          )}
        </div>

        <div className="modal__foot">
          {done ? (
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Готово
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={onConfirm}
              >
                {busy ? 'Сбрасываю…' : 'Сбросить'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
