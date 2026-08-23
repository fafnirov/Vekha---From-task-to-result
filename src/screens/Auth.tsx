import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useSession } from '../store/session'
import { useApp } from '../store/app'
import { Icon } from '../components/ui'
import type { Person } from '../data/types'

/**
 * Вход в приложение. Экран показывает один из трёх режимов:
 * первый запуск (создание администратора), вход и регистрацию по
 * приглашению — какой именно, решает состояние сервера и ссылка.
 */

interface AuthState {
  initialized: boolean
  org: { name: string; unit: string; mark: string } | null
}

type Mode = 'login' | 'setup' | 'invite'

export function Auth() {
  const { refresh } = useSession()
  const { theme, toggleTheme } = useApp()
  const [params] = useSearchParams()
  const inviteToken = params.get('invite') ?? ''

  const [state, setState] = useState<AuthState | null>(null)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /* Режим определяется один раз при открытии: по ссылке и состоянию базы. */
  useEffect(() => {
    let alive = true
    api
      .get<AuthState>('/api/auth/state')
      .then(async (s) => {
        if (!alive) return
        setState(s)
        if (!s.initialized) {
          setMode('setup')
          return
        }
        if (inviteToken) {
          try {
            const invite = await api.get<{ email: string }>(
              `/api/invites/check/${encodeURIComponent(inviteToken)}`,
            )
            if (!alive) return
            setMode('invite')
            setEmail(invite.email)
          } catch {
            if (alive) setError('Ссылка-приглашение недействительна или истекла')
          }
        }
      })
      .catch(() => alive && setError('Сервер недоступен. Проверьте, что он запущен.'))
    return () => {
      alive = false
    }
  }, [inviteToken])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await api.post<{ user: Person }>('/api/auth/login', { email, password })
      } else {
        await api.post<{ user: Person }>('/api/auth/register', {
          email,
          password,
          name,
          jobTitle,
          invite: mode === 'invite' ? inviteToken : undefined,
        })
      }
      refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить вход')
      setBusy(false)
    }
  }

  const titles: Record<Mode, { title: string; note: string; button: string }> = {
    login: {
      title: 'Вход',
      note: state?.org ? state.org.name : 'Трекер задач и проектов',
      button: 'Войти',
    },
    setup: {
      title: 'Первый запуск',
      note: 'Создайте учётную запись администратора — она получит полные права.',
      button: 'Создать организацию',
    },
    invite: {
      title: 'Регистрация по приглашению',
      note: 'Придумайте пароль, адрес почты уже определён приглашением.',
      button: 'Присоединиться',
    },
  }
  const copy = titles[mode]

  return (
    <div className="auth">
      <button
        type="button"
        className="btn btn--icon-quiet auth__theme"
        onClick={toggleTheme}
        aria-label="Сменить тему"
      >
        <Icon name={theme === 'light' ? 'dark_mode' : 'light_mode'} size={18} />
      </button>

      <form className="card card--pad auth__card" onSubmit={submit}>
        <div className="auth__brand">
          <span className="auth__mark">{state?.org?.mark ?? 'В'}</span>
          <div>
            <div className="auth__name">Vekha</div>
            <div className="auth__unit">от задачи к результату</div>
          </div>
        </div>

        <h1 className="auth__title">{copy.title}</h1>
        <p className="auth__note">{copy.note}</p>

        {mode !== 'login' && (
          <>
            <label className="field">
              <span className="label">Имя и фамилия</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Анна Ковалёва"
                autoComplete="name"
                required
                minLength={2}
              />
            </label>
            <label className="field">
              <span className="label">Должность</span>
              <input
                className="input"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Product Lead"
                autoComplete="organization-title"
              />
            </label>
          </>
        )}

        <label className="field">
          <span className="label">Почта</span>
          <input
            className={error ? 'input input--error' : 'input'}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.ru"
            autoComplete="email"
            readOnly={mode === 'invite'}
            required
          />
        </label>

        <label className="field">
          <span className="label">Пароль</span>
          <input
            className={error ? 'input input--error' : 'input'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'login' ? 'Ваш пароль' : 'Не короче восьми символов'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'login' ? undefined : 8}
          />
        </label>

        {error && (
          <div className="auth__error" role="alert">
            <Icon name="error" size={16} color="var(--dang)" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn--primary btn--lg auth__submit" disabled={busy}>
          {busy ? 'Секунду…' : copy.button}
        </button>

        {mode === 'login' && state?.initialized && (
          <p className="auth__hint">
            Нет учётной записи? Попросите администратора прислать ссылку-приглашение.
          </p>
        )}
      </form>
    </div>
  )
}
