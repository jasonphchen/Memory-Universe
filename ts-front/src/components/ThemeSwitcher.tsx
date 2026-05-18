import { useEffect, useMemo, useRef, useState } from 'react'
import type { UniverseTheme, UniverseThemeId } from './universeThemes'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'

type ThemeSwitcherProps = {
  themes: UniverseTheme[]
  selectedThemeId: UniverseThemeId
  onSelectTheme: (themeId: UniverseThemeId) => void
}

const THEME_LABEL_KEYS: Record<UniverseThemeId, TranslationKey> = {
  nebula: 'themeNebula',
  spiral: 'themeSpiral',
  galaxy: 'themeGalaxy',
}

export function ThemeSwitcher({
  themes,
  selectedThemeId,
  onSelectTheme,
}: ThemeSwitcherProps) {
  const { t } = useI18n()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.id === selectedThemeId),
    [themes, selectedThemeId],
  )

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

  return (
    <div ref={wrapperRef} className="theme-switcher">
      <div className="theme-switcher-header">
        <span className="theme-switcher-current">
          {selectedTheme ? t(THEME_LABEL_KEYS[selectedTheme.id]) : t('themeFallback')}
        </span>
        <button
          type="button"
          className="theme-switcher-toggle"
          aria-label={t('switchTheme')}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? '✕' : '🎨'}
        </button>
      </div>
      {isOpen ? (
        <div className="theme-switcher-dropdown">
          <div className="theme-switcher-options">
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-option ${selectedThemeId === theme.id ? 'active' : ''}`}
              onClick={() => {
                onSelectTheme(theme.id)
                setIsOpen(false)
              }}
            >
              {t(THEME_LABEL_KEYS[theme.id])}
            </button>
          ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
