import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

/**
 * Подсказка над элементом.
 *
 * Нативный `title` появляется через секунду с лишним, выглядит системным
 * окошком и не поддаётся оформлению. Здесь: своя задержка, появление с
 * анимацией, стрелка и позиционирование, которое не вылезает за экран.
 * Скрывается по Esc и при прокрутке — иначе подсказка «отклеивается».
 */

type Side = 'top' | 'bottom' | 'left' | 'right'

interface Position {
  top: number
  left: number
  side: Side
}

const GAP = 8
const DELAY = 380

export function Tooltip({
  label,
  hint,
  side = 'top',
  children,
}: {
  label: ReactNode
  /** Вторая строка: горячая клавиша или уточнение. */
  hint?: string
  side?: Side
  children: ReactElement
}) {
  const id = useId()
  const holder = useRef<HTMLSpanElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()
  const [pos, setPos] = useState<Position | null>(null)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!pos) return
    const hide = () => setPos(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()

    window.addEventListener('scroll', hide, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [pos])

  function place() {
    const anchor = holder.current?.firstElementChild ?? holder.current
    if (!anchor) return

    const r = anchor.getBoundingClientRect()
    const width = bubble.current?.offsetWidth ?? 160
    const height = bubble.current?.offsetHeight ?? 30

    let chosen = side
    // Разворачиваем подсказку, если у выбранной стороны нет места.
    if (side === 'top' && r.top < height + GAP) chosen = 'bottom'
    if (side === 'bottom' && r.bottom + height + GAP > window.innerHeight) chosen = 'top'
    if (side === 'left' && r.left < width + GAP) chosen = 'right'
    if (side === 'right' && r.right + width + GAP > window.innerWidth) chosen = 'left'

    const map: Record<Side, Position> = {
      top: { top: r.top - GAP, left: r.left + r.width / 2, side: 'top' },
      bottom: { top: r.bottom + GAP, left: r.left + r.width / 2, side: 'bottom' },
      left: { top: r.top + r.height / 2, left: r.left - GAP, side: 'left' },
      right: { top: r.top + r.height / 2, left: r.right + GAP, side: 'right' },
    }
    setPos(map[chosen])
  }

  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(place, DELAY)
  }

  const hide = () => {
    window.clearTimeout(timer.current)
    setPos(null)
  }

  /*
   * После отрисовки подсказка знает свою ширину — прижимаем её к экрану,
   * иначе у правого края текст переносится по слогам в узкий столбик.
   */
  useLayoutEffect(() => {
    if (!pos || !bubble.current) return
    const box = bubble.current.getBoundingClientRect()
    const margin = 8

    let left = pos.left
    if (pos.side === 'top' || pos.side === 'bottom') {
      const half = box.width / 2
      left = Math.min(Math.max(pos.left, half + margin), window.innerWidth - half - margin)
    }

    if (left !== pos.left) setPos({ ...pos, left })
  }, [pos])

  return (
    <>
      <span
        ref={holder}
        className="tip-holder"
        aria-describedby={pos ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={place}
        onBlur={hide}
      >
        {children}
      </span>

      {pos &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            role="tooltip"
            className={`tip tip--${pos.side}`}
            style={{ top: pos.top, left: pos.left }}
          >
            <span className="tip__label">{label}</span>
            {hint && <span className="tip__hint">{hint}</span>}
          </div>,
          document.body,
        )}
    </>
  )
}
