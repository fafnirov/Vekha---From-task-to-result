import { useMemo } from 'react'
import { Executor } from './ui'
import { usePeople, useTeams } from '../api/hooks'

/**
 * Выбор исполнителя: команда целиком или человек из команды.
 *
 * Плоский список всех, кто зарегистрирован, — плохой способ назначать
 * работу: он не показывает, кто с кем работает, и растёт вместе с
 * организацией. Здесь список устроен так же, как сама команда: сначала
 * «вся команда», следом её люди.
 *
 * Отдельной группой идут те, кто не состоит ни в одной команде, — иначе
 * назначить им работу стало бы нельзя, а такие люди в организации есть
 * всегда: новичок, подрядчик, руководитель.
 *
 * Компонент общий для формы создания и карточки задачи: две копии
 * одного списка неизбежно разошлись бы.
 */

/** Разбор значения списка: `team:Название` или `user:КОД`. */
export type ExecutorPick = { assignee: string | null; team: string | null }

export function parseExecutor(value: string): ExecutorPick {
  if (value.startsWith('team:')) return { assignee: null, team: value.slice(5) }
  if (value.startsWith('user:')) return { assignee: value.slice(5), team: null }
  return { assignee: null, team: null }
}

export function ExecutorSelect({
  assignee,
  team,
  disabled,
  onPick,
}: {
  /** Код выбранного человека. */
  assignee: string | null
  /** Имя выбранной команды. */
  team: string | null
  disabled?: boolean
  onPick: (pick: ExecutorPick) => void
}) {
  const teams = useTeams()
  const people = usePeople()

  /* Кто не состоит ни в одной команде — им тоже надо уметь поручать. */
  const loose = useMemo(() => {
    const inTeam = new Set(
      (teams.data ?? []).flatMap((t) => t.members.map((m) => m.code)),
    )
    return (people.data ?? []).filter((p) => p.active && !inTeam.has(p.code))
  }, [teams.data, people.data])

  const value = team ? `team:${team}` : assignee ? `user:${assignee}` : ''

  return (
    <div className="select-with-avatar">
      <Executor who={assignee} team={team} size="xs" />
      <select
        className="select"
        value={value}
        disabled={disabled}
        onChange={(e) => onPick(parseExecutor(e.target.value))}
      >
        <option value="">Не назначен</option>

        {(teams.data ?? []).map((t) => (
          <optgroup key={t.id} label={t.name}>
            <option value={`team:${t.name}`}>Вся команда «{t.name}»</option>
            {t.members
              .filter((m) => m.active)
              .map((m) => (
                <option key={`${t.id}-${m.code}`} value={`user:${m.code}`}>
                  {m.name}
                </option>
              ))}
          </optgroup>
        ))}

        {loose.length > 0 && (
          <optgroup label="Вне команд">
            {loose.map((p) => (
              <option key={p.id} value={`user:${p.code}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}
