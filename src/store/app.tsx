import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { StatusName, ToastItem, ToastKind } from '../data/types'
import { findTask } from '../data/tasks'
import { RULES, PERMISSIONS, TASK_FIELDS } from '../data/workspace'

type Theme = 'light' | 'dark'

export interface BoardState {
  Backlog: string[]
  'To Do': string[]
  'In Progress': string[]
  Review: string[]
  Done: string[]
}

export type BoardColumnId = keyof BoardState

interface AppState {
  theme: Theme
  navCollapsed: boolean
  /** Status changes made in-session, keyed by task. */
  stOverride: Record<string, StatusName>
  board: BoardState
  boardFold: Record<string, boolean>
  sprintKeys: string[]
  backlogKeys: string[]
  checks: Record<string, boolean>
  fieldReq: Record<string, boolean>
  fieldCard: Record<string, boolean>
  perms: Record<string, boolean[]>
  ruleOn: Record<string, boolean>
}

const THEME_KEY = 'vekha.theme'

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

const initialState: AppState = {
  theme: initialTheme(),
  navCollapsed: false,
  stOverride: {},
  board: {
    Backlog: ['VEKHA-129', 'SEC-9', 'INT-45'],
    'To Do': ['MOB-87', 'LMS-21'],
    'In Progress': ['VEKHA-142', 'VEKHA-141', 'MOB-84', 'REL-24', 'LMS-23'],
    Review: ['VEKHA-138', 'INT-41'],
    Done: ['VEKHA-136', 'VEKHA-131'],
  },
  boardFold: {},
  sprintKeys: ['VEKHA-129', 'MOB-87'],
  backlogKeys: ['LMS-21', 'SEC-9', 'INT-45', 'REL-22', 'SEC-12', 'INT-41'],
  checks: { c1: true, c2: true, c3: false, c4: false },
  fieldReq: Object.fromEntries(TASK_FIELDS.map((f) => [f.id, f.req])),
  fieldCard: Object.fromEntries(TASK_FIELDS.map((f) => [f.id, f.card])),
  perms: Object.fromEntries(PERMISSIONS.map((p) => [p.id, [...p.cells]])),
  ruleOn: Object.fromEntries(RULES.map((r) => [r.id, r.on])),
}

/** Board column -> the status a card takes when dropped there. */
const COLUMN_STATUS: Record<BoardColumnId, StatusName> = {
  Backlog: 'New',
  'To Do': 'Open',
  'In Progress': 'In Progress',
  Review: 'Review',
  Done: 'Done',
}

interface AppApi extends AppState {
  patch: (p: Partial<AppState>) => void
  toasts: ToastItem[]
  toast: (title: string, text: string, kind?: ToastKind) => void
  dismissToast: (id: number) => void
  toggleTheme: () => void
  toggleNav: () => void
  /** Status of a task including any in-session override. */
  statusOf: (key: string) => StatusName
  setStatus: (key: string, status: StatusName) => void
  moveCard: (key: string, to: BoardColumnId, index: number | null) => void
  toggleFold: (col: string) => void
  addToSprint: (key: string) => void
  removeFromSprint: (key: string) => void
  toggleCheck: (id: string) => void
  togglePerm: (rowId: string, index: number) => void
  toggleRule: (id: string) => void
  toggleField: (id: string, kind: 'req' | 'card') => void
}

const Ctx = createContext<AppApi | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [nextToast, setNextToast] = useState(1)

  const patch = useCallback(
    (p: Partial<AppState>) => setState((s) => ({ ...s, ...p })),
    [],
  )

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    window.localStorage.setItem(THEME_KEY, state.theme)
  }, [state.theme])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sbw',
      state.navCollapsed ? '56px' : '228px',
    )
  }, [state.navCollapsed])

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (title: string, text: string, kind: ToastKind = 'ok') => {
      const id = nextToast
      setNextToast((n) => n + 1)
      setToasts((list) => [...list, { id, title, text, kind }])
      window.setTimeout(() => dismissToast(id), 4200)
    },
    [nextToast, dismissToast],
  )

  const statusOf = useCallback(
    (key: string): StatusName => state.stOverride[key] ?? findTask(key).status,
    [state.stOverride],
  )

  const setStatus = useCallback((key: string, status: StatusName) => {
    setState((s) => ({ ...s, stOverride: { ...s.stOverride, [key]: status } }))
  }, [])

  const moveCard = useCallback(
    (key: string, to: BoardColumnId, index: number | null) => {
      setState((s) => {
        const next = {} as BoardState
        ;(Object.keys(s.board) as BoardColumnId[]).forEach((col) => {
          next[col] = s.board[col].filter((k) => k !== key)
        })
        const at =
          index === null
            ? next[to].length
            : Math.max(0, Math.min(next[to].length, index))
        next[to] = [...next[to].slice(0, at), key, ...next[to].slice(at)]
        return {
          ...s,
          board: next,
          stOverride: { ...s.stOverride, [key]: COLUMN_STATUS[to] },
        }
      })
    },
    [],
  )

  const toggleFold = useCallback((col: string) => {
    setState((s) => ({
      ...s,
      boardFold: { ...s.boardFold, [col]: !s.boardFold[col] },
    }))
  }, [])

  const addToSprint = useCallback((key: string) => {
    setState((s) =>
      s.sprintKeys.includes(key)
        ? s
        : {
            ...s,
            sprintKeys: [...s.sprintKeys, key],
            backlogKeys: s.backlogKeys.filter((k) => k !== key),
          },
    )
  }, [])

  const removeFromSprint = useCallback((key: string) => {
    setState((s) => ({
      ...s,
      sprintKeys: s.sprintKeys.filter((k) => k !== key),
      backlogKeys: s.backlogKeys.includes(key)
        ? s.backlogKeys
        : [key, ...s.backlogKeys],
    }))
  }, [])

  const toggleCheck = useCallback((id: string) => {
    setState((s) => ({ ...s, checks: { ...s.checks, [id]: !s.checks[id] } }))
  }, [])

  const togglePerm = useCallback((rowId: string, index: number) => {
    setState((s) => {
      const row = [...(s.perms[rowId] ?? [])]
      row[index] = !row[index]
      return { ...s, perms: { ...s.perms, [rowId]: row } }
    })
  }, [])

  const toggleRule = useCallback((id: string) => {
    setState((s) => ({ ...s, ruleOn: { ...s.ruleOn, [id]: !s.ruleOn[id] } }))
  }, [])

  const toggleField = useCallback((id: string, kind: 'req' | 'card') => {
    setState((s) =>
      kind === 'req'
        ? { ...s, fieldReq: { ...s.fieldReq, [id]: !s.fieldReq[id] } }
        : { ...s, fieldCard: { ...s.fieldCard, [id]: !s.fieldCard[id] } },
    )
  }, [])

  const api = useMemo<AppApi>(
    () => ({
      ...state,
      patch,
      toasts,
      toast,
      dismissToast,
      toggleTheme: () =>
        patch({ theme: state.theme === 'light' ? 'dark' : 'light' }),
      toggleNav: () => patch({ navCollapsed: !state.navCollapsed }),
      statusOf,
      setStatus,
      moveCard,
      toggleFold,
      addToSprint,
      removeFromSprint,
      toggleCheck,
      togglePerm,
      toggleRule,
      toggleField,
    }),
    [
      state,
      patch,
      toasts,
      toast,
      dismissToast,
      statusOf,
      setStatus,
      moveCard,
      toggleFold,
      addToSprint,
      removeFromSprint,
      toggleCheck,
      togglePerm,
      toggleRule,
      toggleField,
    ],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useApp(): AppApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
