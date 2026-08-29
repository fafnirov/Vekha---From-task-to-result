import { useEffect, useState } from 'react'
import { Avatar, Icon } from '../components/ui'
import { ROLE_LABEL } from '../data/catalog'
import { api, ApiError } from '../api/client'
import { useApiMutation } from '../api/hooks'
import { useSession } from '../store/session'
import { useApp } from '../store/app'

/**
 * Личные настройки. Раньше сменить пароль было негде: API это умел,
 * а экрана не было — при забытом пароле оставалось только лезть в базу.
 */
export function Profile() {
  const { me, refresh } = useSession()
  const { toast, toastError } = useApp()

  const [name, setName] = useState(me?.name ?? '')
  const [jobTitle, setJobTitle] = useState(me?.role === '—' ? '' : (me?.role ?? ''))

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (!me) return
    setName(me.name)
    setJobTitle(me.role === '—' ? '' : me.role)
  }, [me?.name, me?.role])

  const save = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.patch('/api/auth/me', body),
    ['people'],
  )

  if (!me) return null

  const profileChanged = name !== me.name || jobTitle !== (me.role === '—' ? '' : me.role)

  async function saveProfile() {
    try {
      await save.mutateAsync({ name: name.trim(), jobTitle: jobTitle.trim() })
      refresh()
      toast('Сохранено', 'Профиль обновлён', 'ok')
    } catch (err) {
      toastError(err)
    }
  }

  async function changePassword() {
    if (next.length < 8) {
      setPasswordError('Новый пароль короче восьми символов')
      return
    }
    if (next !== repeat) {
      setPasswordError('Пароли не совпадают')
      return
    }
    setPasswordError('')

    try {
      await save.mutateAsync({ password: next, currentPassword: current })
      setCurrent('')
      setNext('')
      setRepeat('')
      toast('Пароль изменён', 'Используйте новый пароль при следующем входе', 'ok')
    } catch (err) {
      // Сервер отвечает 403, если текущий пароль не подошёл.
      setPasswordError(
        err instanceof ApiError && err.status === 403
          ? 'Текущий пароль указан неверно'
          : err instanceof Error
            ? err.message
            : 'Не удалось изменить пароль',
      )
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">Профиль</div>
        <span className="page__note">личные настройки, видны только вам</span>
      </div>

      <div className="profile">
        <section className="card card--pad">
          <div className="profile__id">
            <Avatar id={me.code} size="lg" title={false} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{me.name}</div>
              <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{me.email}</div>
            </div>
            <span className="badge spacer" style={{ background: 'var(--ac-soft)', color: 'var(--ac-tx)' }}>
              {ROLE_LABEL[me.accessRole] ?? me.accessRole}
            </span>
          </div>

          <div className="grid-2" style={{ marginTop: 14 }}>
            <label className="label">
              <span>Имя и фамилия</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="label">
              <span>Должность</span>
              <input
                className="input"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Например: Backend"
              />
            </label>
          </div>

          <p className="report__hint" style={{ marginTop: 8 }}>
            Имя и монограмма видны коллегам в задачах, комментариях и на доске.
            Почту и роль меняет администратор.
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!profileChanged || name.trim().length < 2 || save.isPending}
              onClick={() => void saveProfile()}
            >
              Сохранить
            </button>
            {profileChanged && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setName(me.name)
                  setJobTitle(me.role === '—' ? '' : me.role)
                }}
              >
                Отменить
              </button>
            )}
          </div>
        </section>

        <section className="card card--pad">
          <div className="card__title" style={{ marginBottom: 4 }}>
            Смена пароля
          </div>
          <p className="report__hint" style={{ marginBottom: 12 }}>
            Нужен текущий пароль — иначе чужой человек за вашим открытым
            компьютером сменил бы его молча.
          </p>

          <label className="label">
            <span>Текущий пароль</span>
            <input
              className="input"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <label className="label">
              <span>Новый пароль</span>
              <input
                className="input"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Не короче восьми символов"
                autoComplete="new-password"
              />
            </label>
            <label className="label">
              <span>Повторите новый</span>
              <input
                className="input"
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>

          {passwordError && (
            <div className="form-error" style={{ marginTop: 10 }} role="alert">
              <Icon name="error" size={14} />
              {passwordError}
            </div>
          )}

          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 12 }}
            disabled={!current || !next || save.isPending}
            onClick={() => void changePassword()}
          >
            Изменить пароль
          </button>
        </section>
      </div>
    </div>
  )
}
