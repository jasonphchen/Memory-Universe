import { useState } from 'react'
import type { FormEvent } from 'react'

type RegisterFormProps = {
  isLoading: boolean
  onSubmit: (username: string, password: string, secret: string) => Promise<void>
}

export function RegisterForm({ isLoading, onSubmit }: RegisterFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [secret, setSecret] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit(username.trim(), password, secret)
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="auth-label">
        用户名
        <input
          className="auth-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="auth-label">
        密码
        <input
          className="auth-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
      </label>

      <label className="auth-label">
        注册码
        <input
          className="auth-input"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          autoComplete="off"
          required
        />
      </label>

      <button className="auth-submit" type="submit" disabled={isLoading}>
        {isLoading ? '注册中...' : '注册'}
      </button>
    </form>
  )
}
