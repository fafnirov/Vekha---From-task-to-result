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
import { Profile } from './screens/Profile'
import { NoAccess } from './screens/NoAccess'
import { useUi } from './store/ui'
import { useSession } from './store/session'
import { useApp } from './store/app'

export function App() {
  const ui = useUi()
  const { mobileNav, closeMobileNav } = useApp()
  const { me, ready, can } = useSession()

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

  const sees = can('task.view')

  return (
    <div className="shell">
      {mobileNav && <div className="shell__scrim" onClick={closeMobileNav} />}
      <Sidebar />
      <div className="main-col">
        <TopBar />
        <main className="workspace">
          <Routes>
            {/*
              Право «Просмотр задач» закрывает сразу несколько разделов.
              Из меню они спрятаны, но по прямой ссылке дойти можно —
              поэтому здесь стоит явная заглушка, а не пустой экран.
            */}
            <Route path="/" element={sees ? <Home /> : <NoAccess what="Сводка по задачам" />} />
            <Route path="/tasks" element={sees ? <Tasks /> : <NoAccess what="Список задач" />} />
            <Route
              path="/tasks/:key"
              element={sees ? <TaskDetail /> : <NoAccess what="Карточка задачи" />}
            />
            <Route path="/board" element={sees ? <Board /> : <NoAccess what="Доска" />} />
            <Route path="/backlog" element={sees ? <Backlog /> : <NoAccess what="Планирование" />} />
            <Route path="/queues" element={<Queues />} />
            <Route path="/projects" element={<Projects />} />
            <Route
              path="/projects/:name"
              element={sees ? <ProjectDetail /> : <NoAccess what="Карточка проекта" />}
            />
            <Route path="/filters" element={sees ? <Filters /> : <NoAccess what="Фильтры" />} />
            <Route path="/reports" element={sees ? <Reports /> : <NoAccess what="Отчёты" />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="/profile" element={<Profile />} />
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
