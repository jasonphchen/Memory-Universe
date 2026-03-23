import { useEffect, useMemo, useRef, useState } from 'react'
import type { UniverseTheme, UniverseThemeId } from './universeThemes'

type ThemeSwitcherProps = {
  themes: UniverseTheme[]
  selectedThemeId: UniverseThemeId
  onSelectTheme: (themeId: UniverseThemeId) => void
}

export function ThemeSwitcher({
  themes,
  selectedThemeId,
  onSelectTheme,
}: ThemeSwitcherProps) {
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
        <span className="theme-switcher-current">{selectedTheme?.label ?? '主题'}</span>
        <button
          type="button"
          className="theme-switcher-toggle"
          aria-label="切换主题"
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
              {theme.label}
            </button>
          ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
