import { useState } from 'react'
import { Avatar, Icon } from './ui'
import { api } from '../api/client'
import { useApiMutation, useInvalidate } from '../api/hooks'
import { useSession } from '../store/session'
import { useApp } from '../store/app'
import type { WorklogEntry } from '../data/types'

/**
 * Учёт времени. Ввод человеческий: «1ч 30м», «90м», «2ч», «1.5ч» —
 * заставлять человека считать минуты в уме ради поля ввода незачем.
 */

const UNITS: Record<string, number> = {
  д: 8 * 60,
  d: 8 * 60,
  ч: 60,
  h: 60,
  м: 1,
  m: 1,
}

/** Разбирает «1ч 30м» в минуты. Число без единицы считается часами. */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(',', '.')
  if (!text) return null

  // Голое число удобнее трактовать как часы: «2» почти всегда «2 часа».
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 60)

  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*([дdчhмm])/g)]
  if (matches.length === 0) return null

  let total = 0
  for (const [, value, unit] of matches) total += Number(value) * (UNITS[unit] ?? 0)

  const rounded = Math.round(total)
  return rounded > 0 ? rounded : null
}

/** Минуты в подпись «1ч 30м» — та же логика, что и на сервере. */
export function formatMinutes(total: number): string {
  if (total <= 0) return '0м'
  const days = Math.floor(total / (8 * 60))
  const hours = Math.floor((total % (8 * 60)) / 60)
  const minutes = total % 60
  return [days && `${days}д`, hours && `${hours}ч`, minutes && `${minutes}м`]
    .filter(Boolean)
    .join(' ')
}

export function Worklog({
  taskKey,
  total,
  items,
  estimate,
}: {
  taskKey: string
  total: number
  items: WorklogEntry[]
  estimate: number
}) {
  const { me } = useSession()
  const { toast, toastError } = useApp()
  const invalidate = useInvalidate()

  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)

  const log = useApiMutation<{ minutes: number; note: string }, unknown>(
    (body) => api.post(`/api/tasks/${encodeURIComponent(taskKey)}/worklog`, body),
    ['tasks'],
  )
  const drop = useApiMutation<string, unknown>((id) => api.del(`/api/worklog/${id}`), ['tasks'])

  const parsed = parseDuration(value)
  /* Оценка в story points, а не в часах, поэтому сравнивать их нельзя —
     показываем рядом как две независимые величины. */
  const hasEstimate = estimate > 0

  async function submit() {
    if (!parsed) return
    try {
      await log.mutateAsync({ minutes: parsed, note })
      invalidate(['tasks'])
      setValue('')
      setNote('')
      setOpen(false)
      toast('Время списано', formatMinutes(parsed), 'ok')
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <section className="card card--clip" style={{ marginTop: 12 }}>
      <div className="card__head">
        <div className="card__title">Затраченное время</div>
        <span className="count-pill mono">{formatMinutes(total)}</span>
        {hasEstimate && (
          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>оценка {estimate} SP</span>
        )}
        <button type="button" className="btn btn--link spacer" onClick={() => setOpen(!open)}>
          {open ? 'Свернуть' : 'Списать время'}
        </button>
      </div>

      {open && (
        <div className="worklog__form">
          <input
            className={value && !parsed ? 'input input--error' : 'input'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="1ч 30м"
            style={{ width: 110 }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submit()
              }
            }}
          />
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Над чем работали — необязательно"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!parsed || log.isPending}
            onClick={() => void submit()}
          >
            Списать
          </button>
        </div>
      )}

      {open && (
        <div className="worklog__hint">
          {parsed ? `Будет списано ${formatMinutes(parsed)}` : 'Форматы: 1ч 30м, 90м, 2ч, 1.5 — число без единицы считается часами'}
        </div>
      )}

      {items.length === 0 && <div className="task__none">Время пока не списывали</div>}

      {items.map((w) => (
        <div key={w.id} className="worklog__row">
          <Avatar id={w.who} size="md" />
          <span className="mono worklog__amount">{formatMinutes(w.minutes)}</span>
          <span className="ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--tx2)' }}>
            {w.note || '—'}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--tx3)' }}>
            {w.day}
          </span>
          {w.who === me?.code && (
            <button
              type="button"
              className="btn btn--icon-quiet"
              title="Удалить списание"
              onClick={() => void drop.mutateAsync(w.id).catch(toastError)}
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
      ))}
    </section>
  )
}
