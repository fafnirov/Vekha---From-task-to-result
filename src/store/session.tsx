import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, UNAUTHORIZED_EVENT } from '../api/client'
import {
  keys,
  useLiveUpdates,
  useOrg,
  usePeople,
  usePermissions,
  useSections,
} from '../api/hooks'
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
  /**
   * Показывать ли роли раздел меню. Настраивается администратором.
   *
   * Это про вид, а не про доступ: спрятанный раздел убирает пункт из
   * меню и закрывает страницу, но данные защищают права и доступ команд
   * к очередям, а не это.
   */
  sees: (section: string) => boolean
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

  /*
   * Сессия кончилась — вышли сами или истёк срок. Признак хранится
   * отдельно от кэша запросов: сброс кэша не гарантирует, что уже
   * отрисованный экран сменится на форму входа, и человек оставался в
   * интерфейсе, где всё пусто, а каждый запрос отвечает 401.
   */
  const [signedOut, setSignedOut] = useState(false)

  useEffect(() => {
    const onUnauthorized = () => setSignedOut(true)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const authorized = !signedOut && Boolean(meQuery.data?.user)

  useLiveUpdates(authorized)

  const orgQuery = useOrg(authorized)
  const peopleQuery = usePeople(authorized)
  const permissionsQuery = usePermissions(authorized)

  const people = useMemo(() => {
    const map: Record<string, Person> = {}
    for (const p of peopleQuery.data ?? []) map[p.code] = p
    return map
  }, [peopleQuery.data])

  const me = signedOut ? null : (meQuery.data?.user ?? null)

  const allowed = useMemo(() => {
    const matrix = permissionsQuery.data
    if (!matrix || !me) return new Set<string>()
    const column = matrix.roles.findIndex((r) => r.key === me.accessRole)
    if (column === -1) return new Set<string>()
    return new Set(matrix.rows.filter((row) => row.cells[column]).map((row) => row.id))
  }, [permissionsQuery.data, me])

  const can = useCallback((permission: string) => allowed.has(permission), [allowed])

  const sectionsQuery = useSections()

  const visibleSections = useMemo(() => {
    const matrix = sectionsQuery.data
    if (!matrix || !me) return null
    const column = matrix.roles.findIndex((r) => r.key === me.accessRole)
    if (column === -1) return null
    return new Set(matrix.rows.filter((row) => row.cells[column]).map((row) => row.id))
  }, [sectionsQuery.data, me])

  /*
   * Пока настройка не загружена, показываем всё: прятать разделы на
   * долю секунды и возвращать обратно — хуже, чем показать лишнее
   * человеку, которому они и так по правам доступны.
   */
  const sees = useCallback(
    (section: string) => visibleSections === null || visibleSections.has(section),
    [visibleSections],
  )

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout')
    setSignedOut(true)
    qc.clear()
  }, [qc])

  /*
   * После входа перезапрашиваем всё: до него часть запросов отвечала 401,
   * и без сброса интерфейс остался бы без прав и справочников.
   */
  const refresh = useCallback(() => {
    setSignedOut(false)
    void qc.invalidateQueries()
  }, [qc])

  const value = useMemo<SessionApi>(
    () => ({
      me,
      org: orgQuery.data ?? FALLBACK_ORG,
      people,
      list: peopleQuery.data ?? [],
      // Вышедшему ждать нечего: форма входа показывается сразу.
      ready: signedOut || !meQuery.isLoading,
      can,
      sees,
      logout,
      refresh,
    }),
    [
      me,
      orgQuery.data,
      people,
      peopleQuery.data,
      meQuery.isLoading,
      signedOut,
      can,
      sees,
      logout,
      refresh,
    ],
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
