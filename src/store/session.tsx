import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import { keys, useLiveUpdates, useOrg, usePeople, usePermissions } from '../api/hooks'
import type { Org, Person } from '../data/types'

interface SessionApi {
  me: Person | null
  org: Org
  /** Справочник участников по короткому коду — им ссылаются задачи. */
  people: Record<string, Person>
  list: Person[]
  ready: boolean
  /** Есть ли у текущей роли право. Сервер проверяет то же самое. */
  can: (permission: string) => boolean
  logout: () => Promise<void>
  refresh: () => void
}

const FALLBACK_ORG: Org = { name: 'Vekha', unit: '', mark: 'В', version: '3.0' }

/** Пока справочник не загружен, аватар не должен ронять экран. */
const UNKNOWN: Person = {
  id: '',
  code: '??',
  who: '??',
  name: 'Неизвестный участник',
  role: '—',
  accessRole: 'viewer',
  email: '',
  bg: 'var(--n-bg)',
  fg: 'var(--tx2)',
  active: false,
}

const Ctx = createContext<SessionApi | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()

  const meQuery = useQuery({
    queryKey: keys.me,
    queryFn: () => api.get<{ user: Person }>('/api/auth/me'),
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2,
  })

  const authorized = Boolean(meQuery.data?.user)

  useLiveUpdates(authorized)

  const orgQuery = useOrg()
  const peopleQuery = usePeople()
  const permissionsQuery = usePermissions()

  const people = useMemo(() => {
    const map: Record<string, Person> = {}
    for (const p of peopleQuery.data ?? []) map[p.code] = p
    return map
  }, [peopleQuery.data])

  const me = meQuery.data?.user ?? null

  const allowed = useMemo(() => {
    const matrix = permissionsQuery.data
    if (!matrix || !me) return new Set<string>()
    const column = matrix.roles.findIndex((r) => r.key === me.accessRole)
    if (column === -1) return new Set<string>()
    return new Set(matrix.rows.filter((row) => row.cells[column]).map((row) => row.id))
  }, [permissionsQuery.data, me])

  const can = useCallback((permission: string) => allowed.has(permission), [allowed])

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout')
    qc.clear()
  }, [qc])

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: keys.me })
  }, [qc])

  const value = useMemo<SessionApi>(
    () => ({
      me,
      org: orgQuery.data ?? FALLBACK_ORG,
      people,
      list: peopleQuery.data ?? [],
      ready: !meQuery.isLoading,
      can,
      logout,
      refresh,
    }),
    [me, orgQuery.data, people, peopleQuery.data, meQuery.isLoading, can, logout, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): SessionApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

/** Участник по коду. Возвращает заглушку, если справочник ещё грузится. */
export function usePerson(code: string | null | undefined): Person {
  const { people } = useSession()
  if (!code) return UNKNOWN
  return people[code] ?? { ...UNKNOWN, code, who: code.slice(0, 2) }
}

export { UNKNOWN as UNKNOWN_PERSON }
