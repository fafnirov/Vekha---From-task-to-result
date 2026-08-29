import { Icon } from './ui'
import { useApp } from '../store/app'
import type { ToastKind } from '../data/types'

const KIND: Record<ToastKind, { c: string; icon: string }> = {
  ok: { c: 'var(--ok)', icon: 'check_circle' },
  info: { c: 'var(--info)', icon: 'info' },
  warn: { c: 'var(--warn)', icon: 'warning' },
  err: { c: 'var(--dang)', icon: 'error' },
}

export function Toasts() {
  const { toasts, dismissToast } = useApp()
  if (toasts.length === 0) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => {
        const k = KIND[t.kind]
        return (
          <div key={t.id} className="toast" style={{ borderLeftColor: k.c }}>
            <Icon name={k.icon} size={18} color={k.c} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{t.text}</div>
            </div>
            <button
              type="button"
              className="btn btn--icon-quiet spacer"
              onClick={() => dismissToast(t.id)}
              aria-label="Закрыть"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
