/**
 * Шина событий для живого обновления интерфейса.
 * Клиенты подписываются на GET /api/events (Server-Sent Events) и получают
 * короткие сообщения вида {"scope":"tasks"} — этого достаточно, чтобы
 * перезапросить нужные данные, не выдумывая протокол синхронизации.
 */

import { EventEmitter } from 'node:events'

export type Scope =
  | 'tasks'
  | 'board'
  | 'comments'
  | 'notifications'
  | 'projects'
  | 'queues'
  | 'sprints'
  | 'teams'
  | 'workflow'
  | 'people'
  | 'sections'

export interface ChangeEvent {
  scope: Scope
  /** Ключ задачи или идентификатор сущности, если событие точечное. */
  id?: string
  /** Кому адресовано; пусто — всем. */
  userId?: string
}

class Bus extends EventEmitter {}

export const bus = new Bus()
bus.setMaxListeners(0)

export function emitChange(event: ChangeEvent): void {
  bus.emit('change', event)
}

/** Несколько областей одним вызовом — обычная ситуация при правке задачи. */
export function emitChanges(scopes: Scope[], id?: string): void {
  for (const scope of scopes) emitChange({ scope, id })
}
