import { useState } from 'react'
import type { FormEvent } from 'react'
import { useI18n } from '../../i18n/I18nContext'

type LoginFormProps = {
  isLoading: boolean
  onSubmit: (username: string, password: string) => Promise<void>
}

export function LoginForm({ isLoading, onSubmit }: LoginFormProps) {
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit(username.trim(), password)
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="auth-label">
        {t('username')}
        <input
          className="auth-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="auth-label">
        {t('password')}
        <input
          className="auth-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <button className="auth-submit" type="submit" disabled={isLoading}>
        {isLoading ? t('loggingIn') : t('login')}
      </button>
    </form>
  )
}
