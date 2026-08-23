/**
 * Хуки данных поверх React Query. Ключи запросов совпадают с областями,
 * которые сервер присылает по SSE, поэтому обновление приходит само —
 * см. useLiveUpdates.
 */

import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { api, apiUrl } from './client'
import type {
  Board,
  Burndown,
  Comment,
  Dashboard,
  FilterFieldCatalog,
  FilterLibrary,
  HistoryItem,
  Invite,
  Notification,
  Org,
  PermissionMatrix,
  Person,
  Planning,
  Project,
  ProjectDetail,
  Queue,
  Reports,
  AutomationRule,
  SearchResult,
  Sprint,
  Task,
  TaskDetail,
  TaskField,
  TaskPage,
  TaskTemplate,
  Team,
  Workflow,
} from '../data/types'

/* ── Ключи ────────────────────────────────────────────────────────────── */

export const keys = {
  me: ['me'] as const,
  org: ['org'] as const,
  people: ['people'] as const,
  queues: ['queues'] as const,
  projects: ['projects'] as const,
  project: (name: string) => ['project', name] as const,
  tasks: (params: unknown) => ['tasks', params] as const,
  task: (key: string) => ['task', key] as const,
  comments: (key: string) => ['comments', key] as const,
  history: (key: string) => ['history', key] as const,
  board: (params: unknown) => ['board', params] as const,
  planning: (params: unknown) => ['planning', params] as const,
  sprints: ['sprints'] as const,
  teams: ['teams'] as const,
  workflows: ['workflows'] as const,
  fields: ['fields'] as const,
  permissions: ['permissions'] as const,
  rules: ['rules'] as const,
  templates: ['templates'] as const,
  filters: ['filters'] as const,
  filterFields: ['filterFields'] as const,
  reports: (params: unknown) => ['reports', params] as const,
  burndown: (params: unknown) => ['burndown', params] as const,
  dashboard: ['dashboard'] as const,
  notifications: ['notifications'] as const,
  activity: (params: unknown) => ['activity', params] as const,
  search: (q: string) => ['search', q] as const,
  invites: ['invites'] as const,
  tags: ['tags'] as const,
}

/** Какие ключи обновлять, когда сервер сообщает об изменении области. */
const SCOPE_KEYS: Record<string, string[][]> = {
  tasks: [['tasks'], ['task'], ['dashboard'], ['reports'], ['filters'], ['activity']],
  board: [['board'], ['dashboard']],
  comments: [['comments'], ['task'], ['history'], ['activity']],
  notifications: [['notifications'], ['dashboard']],
  projects: [['projects'], ['project'], ['dashboard']],
  queues: [['queues'], ['tasks']],
  sprints: [['sprints'], ['planning'], ['burndown'], ['reports'], ['dashboard']],
  teams: [['teams']],
  workflow: [['workflows'], ['fields'], ['permissions'], ['rules'], ['templates'], ['board']],
  people: [['people'], ['teams']],
}

/**
 * Подписка на поток изменений. Одно соединение на приложение: любое
 * событие превращается в пометку «устарело» для нужных запросов.
 */
export function useLiveUpdates(enabled: boolean): void {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    const source = new EventSource(apiUrl('/api/events'), { withCredentials: true })

    source.onmessage = (event) => {
      try {
        const { scope } = JSON.parse(event.data) as { scope: string }
        for (const key of SCOPE_KEYS[scope] ?? []) {
          void qc.invalidateQueries({ queryKey: key })
        }
      } catch {
        /* Некорректное сообщение не должно ломать подписку. */
      }
    }

    return () => source.close()
  }, [qc, enabled])
}

/* ── Чтение ───────────────────────────────────────────────────────────── */

type Options<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>

/*
 * Справочные запросы сессии принимают `enabled`: до входа они возвращали
 * 401, ошибка оседала в кэше и после входа уже не повторялась — интерфейс
 * оставался без справочника людей и без прав.
 */
export const useOrg = (enabled = true) =>
  useQuery({ queryKey: keys.org, queryFn: () => api.get<Org>('/api/org'), enabled })

export const usePeople = (enabled = true) =>
  useQuery({ queryKey: keys.people, queryFn: () => api.get<Person[]>('/api/people'), enabled })

export const useQueues = () =>
  useQuery({ queryKey: keys.queues, queryFn: () => api.get<Queue[]>('/api/queues') })

export const useProjects = () =>
  useQuery({ queryKey: keys.projects, queryFn: () => api.get<Project[]>('/api/projects') })

export const useProject = (name: string) =>
  useQuery({
    queryKey: keys.project(name),
    queryFn: () => api.get<ProjectDetail>(`/api/projects/${encodeURIComponent(name)}`),
    enabled: Boolean(name),
  })

export interface TaskQuery {
  q?: string
  queue?: string
  status?: string
  category?: string
  priority?: string
  assignee?: string
  project?: string
  sprint?: string
  tag?: string
  search?: string
  mine?: boolean
  watching?: boolean
  overdue?: boolean
  unassigned?: boolean
  parent?: string
  page?: number
  perPage?: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export const useTasks = (params: TaskQuery = {}, options?: Options<TaskPage>) =>
  useQuery({
    queryKey: keys.tasks(params),
    queryFn: () => api.get<TaskPage>('/api/tasks', params as Record<string, unknown>),
    placeholderData: (prev) => prev,
    ...options,
  })

export const useTask = (key: string) =>
  useQuery({
    queryKey: keys.task(key),
    queryFn: () => api.get<TaskDetail>(`/api/tasks/${encodeURIComponent(key)}`),
    enabled: Boolean(key),
  })

export const useComments = (key: string) =>
  useQuery({
    queryKey: keys.comments(key),
    queryFn: () => api.get<Comment[]>(`/api/tasks/${encodeURIComponent(key)}/comments`),
    enabled: Boolean(key),
  })

export const useHistory = (key: string) =>
  useQuery({
    queryKey: keys.history(key),
    queryFn: () => api.get<HistoryItem[]>(`/api/tasks/${encodeURIComponent(key)}/history`),
    enabled: Boolean(key),
  })

export const useBoard = (params: { queue?: string; sprint?: string; assignee?: string } = {}) =>
  useQuery({
    queryKey: keys.board(params),
    queryFn: () => api.get<Board>('/api/board', params),
    placeholderData: (prev) => prev,
  })

export const usePlanning = (params: { sprint?: string; queue?: string } = {}) =>
  useQuery({
    queryKey: keys.planning(params),
    queryFn: () => api.get<Planning>('/api/planning', params),
    placeholderData: (prev) => prev,
  })

export const useSprints = () =>
  useQuery({ queryKey: keys.sprints, queryFn: () => api.get<Sprint[]>('/api/sprints') })

export const useTeams = () =>
  useQuery({ queryKey: keys.teams, queryFn: () => api.get<Team[]>('/api/teams') })

export const useWorkflows = () =>
  useQuery({ queryKey: keys.workflows, queryFn: () => api.get<Workflow[]>('/api/workflows') })

export const useFields = () =>
  useQuery({ queryKey: keys.fields, queryFn: () => api.get<TaskField[]>('/api/fields') })

export const usePermissions = (enabled = true) =>
  useQuery({
    queryKey: keys.permissions,
    queryFn: () => api.get<PermissionMatrix>('/api/permissions'),
    enabled,
  })

export const useRules = () =>
  useQuery({ queryKey: keys.rules, queryFn: () => api.get<AutomationRule[]>('/api/rules') })

export const useTemplates = () =>
  useQuery({ queryKey: keys.templates, queryFn: () => api.get<TaskTemplate[]>('/api/templates') })

export const useFilters = () =>
  useQuery({ queryKey: keys.filters, queryFn: () => api.get<FilterLibrary>('/api/filters') })

export const useFilterFields = () =>
  useQuery({
    queryKey: keys.filterFields,
    queryFn: () => api.get<FilterFieldCatalog>('/api/filters/fields'),
  })

export const useReports = (params: { queue?: string; weeks?: number } = {}) =>
  useQuery({ queryKey: keys.reports(params), queryFn: () => api.get<Reports>('/api/reports', params) })

export const useBurndown = (params: { sprint?: string; queue?: string } = {}) =>
  useQuery({
    queryKey: keys.burndown(params),
    queryFn: () => api.get<Burndown>('/api/reports/burndown', params),
  })

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<Dashboard>('/api/dashboard') })

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => api.get<{ items: Notification[]; unread: number }>('/api/notifications'),
  })

export const useSearch = (q: string) =>
  useQuery({
    queryKey: keys.search(q),
    queryFn: () => api.get<SearchResult>('/api/search', { q }),
    enabled: q.trim().length > 0,
  })

export const useInvites = (enabled: boolean) =>
  useQuery({
    queryKey: keys.invites,
    queryFn: () => api.get<Invite[]>('/api/invites'),
    enabled,
  })

export const useTags = () =>
  useQuery({
    queryKey: keys.tags,
    queryFn: () => api.get<{ name: string; n: number }[]>('/api/tags'),
  })

/* ── Изменения ────────────────────────────────────────────────────────── */

/**
 * Общая мутация: выполняет запрос и помечает перечисленные области
 * устаревшими. Отдельные хуки на каждое действие не нужны — форма
 * вызова везде одинаковая.
 */
export function useApiMutation<TInput, TResult>(
  run: (input: TInput) => Promise<TResult>,
  scopes: string[] = ['tasks'],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      for (const scope of scopes) {
        for (const key of SCOPE_KEYS[scope] ?? [[scope]]) {
          void qc.invalidateQueries({ queryKey: key })
        }
      }
    },
  })
}

export function useInvalidate() {
  const qc = useQueryClient()
  return (scopes: string[]) => {
    for (const scope of scopes) {
      for (const key of SCOPE_KEYS[scope] ?? [[scope]]) {
        void qc.invalidateQueries({ queryKey: key })
      }
    }
  }
}

/* Готовые мутации для самых частых действий. */

export const useCreateTask = () =>
  useApiMutation<Record<string, unknown>, { task: Task }>(
    (body) => api.post('/api/tasks', body),
    ['tasks', 'board', 'queues', 'projects'],
  )

export const useUpdateTask = () =>
  useApiMutation<{ key: string; patch: Record<string, unknown> }, { task: Task }>(
    ({ key, patch }) => api.patch(`/api/tasks/${encodeURIComponent(key)}`, patch),
    ['tasks', 'board', 'projects', 'sprints', 'comments'],
  )

export const useMoveCard = () =>
  useApiMutation<
    {
      key: string
      column: string
      index: number | null
      /* Фильтры доски: сервер считает позицию по тому же набору карточек. */
      queue?: string
      sprint?: string
      assignee?: string
    },
    { task: Task }
  >((body) => api.patch('/api/board/move', body), ['board', 'tasks', 'sprints'])

export const useAddComment = () =>
  useApiMutation<{ key: string; text: string }, Comment>(
    ({ key, text }) => api.post(`/api/tasks/${encodeURIComponent(key)}/comments`, { text }),
    ['comments'],
  )

export const useBulkUpdate = () =>
  useApiMutation<Record<string, unknown>, { applied: number; failed: { key: string; reason: string }[] }>(
    (body) => api.post('/api/tasks/bulk', body),
    ['tasks', 'board'],
  )
