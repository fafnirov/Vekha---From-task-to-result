import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface UiApi {
  searchOpen: boolean
  createOpen: boolean
  notifOpen: boolean
  createModal: boolean
  openSearch: () => void
  closeSearch: () => void
  toggleCreateMenu: () => void
  toggleNotif: () => void
  openCreateModal: () => void
  closeCreateModal: () => void
  closeAll: () => void
}

const Ctx = createContext<UiApi | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [createModal, setCreateModal] = useState(false)

  const closeAll = useCallback(() => {
    setSearchOpen(false)
    setCreateOpen(false)
    setNotifOpen(false)
    setCreateModal(false)
  }, [])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setCreateOpen(false)
    setNotifOpen(false)
  }, [])

  const openCreateModal = useCallback(() => {
    setCreateModal(true)
    setCreateOpen(false)
  }, [])

  /* Global shortcuts: Cmd/Ctrl+K and / open search, C creates, Esc closes. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? ''
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openSearch()
        return
      }
      if (e.key === 'Escape') {
        closeAll()
        return
      }
      if (e.metaKey || e.ctrlKey || typing) return
      if (e.key === '/') {
        e.preventDefault()
        openSearch()
      }
      if (e.key === 'c' || e.key === 'с') {
        e.preventDefault()
        setCreateModal(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSearch, closeAll])

  const api = useMemo<UiApi>(
    () => ({
      searchOpen,
      createOpen,
      notifOpen,
      createModal,
      openSearch,
      closeSearch: () => setSearchOpen(false),
      toggleCreateMenu: () => {
        setCreateOpen((v) => !v)
        setNotifOpen(false)
      },
      toggleNotif: () => {
        setNotifOpen((v) => !v)
        setCreateOpen(false)
      },
      openCreateModal,
      closeCreateModal: () => setCreateModal(false),
      closeAll,
    }),
    [searchOpen, createOpen, notifOpen, createModal, openSearch, openCreateModal, closeAll],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useUi(): UiApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>')
  return ctx
}
