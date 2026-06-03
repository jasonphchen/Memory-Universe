import { useEffect, useMemo, useRef, useState } from 'react'
import type { MemoryNode } from './memory.types'
import { useI18n } from '../i18n/I18nContext'

type SearchBoxProps = {
  memories: MemoryNode[]
  onSelectMemory: (memoryId: string) => void
}

const MAX_RESULTS = 8

export function SearchBox({ memories, onSelectMemory }: SearchBoxProps) {
  const { t } = useI18n()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return memories
      .filter(
        (memory) =>
          memory.title.toLowerCase().includes(needle) ||
          (memory.location ?? '').toLowerCase().includes(needle),
      )
      .slice(0, MAX_RESULTS)
  }, [query, memories])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const handleSelect = (memoryId: string) => {
    onSelectMemory(memoryId)
    setQuery('')
    setIsOpen(false)
  }

  const showDropdown = isOpen && query.trim().length > 0

  return (
    <div ref={wrapperRef} className="memory-search">
      <input
        type="search"
        className="memory-search-input"
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
      />
      {showDropdown ? (
        <ul className="memory-search-results">
          {results.length > 0 ? (
            results.map((memory) => (
              <li key={memory.id}>
                <button
                  type="button"
                  className="memory-search-result"
                  onClick={() => handleSelect(memory.id)}
                >
                  <span className="memory-search-result-title">{memory.title}</span>
                  {memory.location ? (
                    <span className="memory-search-result-location">{memory.location}</span>
                  ) : null}
                </button>
              </li>
            ))
          ) : (
            <li className="memory-search-empty">{t('searchNoResults')}</li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
