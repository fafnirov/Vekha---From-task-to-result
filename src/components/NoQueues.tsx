import { useNavigate } from 'react-router-dom'
import { Icon } from './ui'
import { useSession } from '../store/session'

/**
 * Заглушка для форм, которым нужна очередь, когда очередей ещё нет.
 *
 * Без неё пустой список выглядел как поломка: форма требовала выбрать
 * очередь, а выбирать было не из чего, и пользователь упирался в тупик.
 */
export function NoQueues({ what }: { what: 'задачу' | 'проект' }) {
  const nav = useNavigate()
  const { can } = useSession()

  return (
    <div className="no-queues">
      <span className="no-queues__icon">
        <Icon name="layers" size={22} color="var(--tx3)" />
      </span>

      <div style={{ fontSize: 14, fontWeight: 600 }}>Сначала нужна очередь</div>

      <p className="no-queues__text">
        Очередь — контейнер задач со своей схемой работы и правами. Её ключ
        подставляется в номера задач: очередь <span className="mono">KAVO</span> даёт{' '}
        <span className="mono">KAVO-1</span>, <span className="mono">KAVO-2</span> и так
        далее. Пока нет ни одной очереди, создать {what} некуда.
      </p>

      {can('workflow.manage') ? (
        <button type="button" className="btn btn--primary" onClick={() => nav('/queues?new=1')}>
          <Icon name="add" size={16} />
          Создать очередь
        </button>
      ) : (
        <p className="no-queues__text">
          Очередь заводит администратор — попросите его создать первую.
        </p>
      )}
    </div>
  )
}
