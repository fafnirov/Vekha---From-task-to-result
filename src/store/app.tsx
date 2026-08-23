import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ToastItem, ToastKind } from '../data/types'

/**
 * Состояние оболочки: тема, сворачивание навигации и всплывающие
 * уведомления. Доменных данных здесь нет — они живут в API и React Query.
 */

type Theme = 'light' | 'dark'

const THEME_KEY = 'vekha.theme'
const NAV_KEY = 'vekha.nav'

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function initialNav(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(NAV_KEY) === '1'
}

interface AppApi {
  theme: Theme
  navCollapsed: boolean
  toggleTheme: () => void
  toggleNav: () => void
  toasts: ToastItem[]
  toast: (title: string, text: string, kind?: ToastKind) => void
  /** Показать ошибку из ответа API одной строкой. */
  toastError: (error: unknown, title?: string) => void
  dismissToast: (id: number) => void
}

const Ctx = createContext<AppApi | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [navCollapsed, setNavCollapsed] = useState<boolean>(initialNav)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--sbw', navCollapsed ? '56px' : '228px')
    window.localStorage.setItem(NAV_KEY, navCollapsed ? '1' : '0')
  }, [navCollapsed])

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (title: string, text: string, kind: ToastKind = 'ok') => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, title, text, kind }])
      window.setTimeout(() => dismissToast(id), 4200)
    },
    [dismissToast],
  )

  const toastError = useCallback(
    (error: unknown, title = 'Не получилось') => {
      const text = error instanceof Error ? error.message : 'Неизвестная ошибка'
      toast(title, text, 'err')
    },
    [toast],
  )

  const api = useMemo<AppApi>(
    () => ({
      theme,
      navCollapsed,
      toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
      toggleNav: () => setNavCollapsed((v) => !v),
      toasts,
      toast,
      toastError,
      dismissToast,
    }),
    [theme, navCollapsed, toasts, toast, toastError, dismissToast],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useApp(): AppApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
