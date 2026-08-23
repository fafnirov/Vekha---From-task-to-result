/**
 * Тонкая обёртка над fetch. Кука с токеном ставится сервером и уходит
 * автоматически, поэтому здесь нет ни заголовков авторизации, ни хранения
 * токена в localStorage.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function unwrap(res: Response): Promise<unknown> {
  if (res.status === 204) return null

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Ошибка ${res.status}`
    throw new ApiError(message, res.status)
  }
  return data
}

function url(path: string, params?: Record<string, unknown>): string {
  if (!params) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','))
    } else {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

async function send(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return unwrap(res)
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>): Promise<T> =>
    fetch(url(path, params), { credentials: 'same-origin' }).then(unwrap) as Promise<T>,
  post: <T>(path: string, body?: unknown): Promise<T> => send('POST', path, body) as Promise<T>,
  patch: <T>(path: string, body?: unknown): Promise<T> => send('PATCH', path, body) as Promise<T>,
  del: <T>(path: string): Promise<T> => send('DELETE', path) as Promise<T>,

  /** Загрузка файла: тело — FormData, поэтому Content-Type ставит браузер. */
  upload: async <T>(path: string, file: File): Promise<T> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(path, { method: 'POST', credentials: 'same-origin', body: form })
    return unwrap(res) as Promise<T>
  },
}
