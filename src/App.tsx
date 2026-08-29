import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { Toasts } from './components/Toasts'
import { SearchPalette } from './components/SearchPalette'
import { CreateTaskModal } from './components/CreateTaskModal'
import { Auth } from './screens/Auth'
import { Home } from './screens/Home'
import { Tasks } from './screens/Tasks'
import { TaskDetail } from './screens/TaskDetail'
import { Board } from './screens/Board'
import { Backlog } from './screens/Backlog'
import { Projects } from './screens/Projects'
import { ProjectDetail } from './screens/ProjectDetail'
import { Queues } from './screens/Queues'
import { Teams } from './screens/Teams'
import { Filters } from './screens/Filters'
import { Reports } from './screens/Reports'
import { Workflow } from './screens/Workflow'
import { useUi } from './store/ui'
import { useSession } from './store/session'
import { useApp } from './store/app'

export function App() {
  const ui = useUi()
  const { mobileNav, closeMobileNav } = useApp()
  const { me, ready } = useSession()

  // Пока проверяется сессия, экран остаётся пустым: мигание формой входа
  // при каждом обновлении страницы выглядит как ошибка.
  if (!ready) return <div className="boot" aria-busy="true" />

  if (!me) {
    return (
      <>
        <Routes>
          <Route path="*" element={<Auth />} />
        </Routes>
        <Toasts />
      </>
    )
  }

  return (
    <div className="shell">
      {mobileNav && <div className="shell__scrim" onClick={closeMobileNav} />}
      <Sidebar />
      <div className="main-col">
        <TopBar />
        <main className="workspace">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tasks/:key" element={<TaskDetail />} />
            <Route path="/board" element={<Board />} />
            <Route path="/backlog" element={<Backlog />} />
            <Route path="/queues" element={<Queues />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:name" element={<ProjectDetail />} />
            <Route path="/filters" element={<Filters />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {ui.searchOpen && <SearchPalette />}
      {ui.createModal && <CreateTaskModal />}
      <Toasts />
    </div>
  )
}
