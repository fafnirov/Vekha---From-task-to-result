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
import { Hidden, NoAccess } from './screens/NoAccess'
import { useUi } from './store/ui'
import { useSession } from './store/session'
import { useApp } from './store/app'

export function App() {
  const ui = useUi()
  const { mobileNav, closeMobileNav } = useApp()
  const { me, ready, can, sees } = useSession()

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

  const canSeeTasks = can('task.view')

  return (
    <div className="shell">
      {mobileNav && <div className="shell__scrim" onClick={closeMobileNav} />}
      <Sidebar />
      <div className="main-col">
        <TopBar />
        <main className="workspace">
          <Routes>
            {/*
              Два независимых ограничения на один маршрут.

              «Раздел» — выбор администратора: какие пункты показывать
              роли. Право «Просмотр задач» — про данные. Скрытый раздел
              и отсутствующее право дают разные объяснения, поэтому и
              заглушки разные: в первом случае человеку нечего просить,
              во втором — есть.

              Проверка стоит и на маршруте, а не только в меню: пункт
              спрятан, но ссылку можно ввести руками или получить в
              переписке.
            */}
            <Route
              path="/"
              element={
                !sees('home') ? <Hidden /> : canSeeTasks ? <Home /> : <NoAccess what="Сводка по задачам" />
              }
            />
            <Route
              path="/tasks"
              element={
                !sees('tasks') ? <Hidden /> : canSeeTasks ? <Tasks /> : <NoAccess what="Список задач" />
              }
            />
            <Route
              path="/tasks/:key"
              element={canSeeTasks ? <TaskDetail /> : <NoAccess what="Карточка задачи" />}
            />
            <Route
              path="/board"
              element={
                !sees('board') ? <Hidden /> : canSeeTasks ? <Board /> : <NoAccess what="Доска" />
              }
            />
            <Route
              path="/backlog"
              element={
                !sees('sprints') ? <Hidden /> : canSeeTasks ? <Backlog /> : <NoAccess what="Планирование" />
              }
            />
            <Route path="/queues" element={sees('queues') ? <Queues /> : <Hidden />} />
            <Route path="/projects" element={sees('projects') ? <Projects /> : <Hidden />} />
            <Route
              path="/projects/:name"
              element={canSeeTasks ? <ProjectDetail /> : <NoAccess what="Карточка проекта" />}
            />
            <Route
              path="/filters"
              element={
                !sees('filters') ? <Hidden /> : canSeeTasks ? <Filters /> : <NoAccess what="Фильтры" />
              }
            />
            <Route
              path="/reports"
              element={
                !sees('reports') ? <Hidden /> : canSeeTasks ? <Reports /> : <NoAccess what="Отчёты" />
              }
            />
            <Route path="/teams" element={sees('teams') ? <Teams /> : <Hidden />} />
            <Route path="/workflow" element={sees('settings') ? <Workflow /> : <Hidden />} />
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
