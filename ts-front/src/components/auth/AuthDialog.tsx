import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { authService } from '../../services'
import type { ApiError, AuthResponse } from '../../types/api'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { useI18n } from '../../i18n/I18nContext'

type AuthDialogProps = {
  isOpen: boolean
  onClose: () => void
  onAuthSuccess: (response: AuthResponse) => void
}

type AuthMode = 'login' | 'register'

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as ApiError).message)
  }
  return fallback
}

export function AuthDialog({ isOpen, onClose, onAuthSuccess }: AuthDialogProps) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [mode, setMode] = useState<AuthMode>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
      return
    }

    if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const submitLogin = async (username: string, password: string) => {
    if (!username || !password) {
      setError(t('enterUsernamePassword'))
      return
    }

    try {
      setIsLoading(true)
      setError('')
      const response = await authService.login(username, password)
      onAuthSuccess(response)
      onClose()
    } catch (authError) {
      setError(getErrorMessage(authError, t('authFailed')))
    } finally {
      setIsLoading(false)
    }
  }

  const submitRegister = async (username: string, password: string, secret: string) => {
    if (!username || !password || !secret) {
      setError(t('enterUsernamePasswordSecret'))
      return
    }

    try {
      setIsLoading(true)
      setError('')
      const response = await authService.register(username, password, secret)
      onAuthSuccess(response)
      onClose()
    } catch (authError) {
      setError(getErrorMessage(authError, t('authFailed')))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="auth-dialog" onClick={handleBackdropClick} onClose={onClose}>
      <div className="auth-dialog-content">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            {t('login')}
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            {t('register')}
          </button>
        </div>

        <p className="auth-subtitle"></p>

        {error ? <p className="auth-error">{error}</p> : null}

        {mode === 'login' ? (
          <LoginForm isLoading={isLoading} onSubmit={submitLogin} />
        ) : (
          <RegisterForm isLoading={isLoading} onSubmit={submitRegister} />
        )}
      </div>
    </dialog>
  )
}
