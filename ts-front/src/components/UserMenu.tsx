import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'

type UserMenuProps = {
  username: string
  onLogout: () => void
}

export function UserMenu({ username, onLogout }: UserMenuProps) {
  const { t } = useI18n()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const greeting = t('greeting', { name: username })

  return (
    <div ref={wrapperRef} className="auth-toolbar user-menu">
      <button
        type="button"
        className="auth-user-button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={greeting}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="auth-user-name">{greeting}</span>
      </button>
      {isOpen ? (
        <div className="user-menu-dropdown" role="menu">
          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false)
              onLogout()
            }}
          >
            {t('logout')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
