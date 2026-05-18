import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SUPPORTED_LANGS, translate, translations, type Lang } from './translations'
import { I18nContext, type I18nContextValue, type TranslateFn } from './I18nContext'

/** Read the language from the first path segment, if it is a supported one. */
function langFromPath(): Lang | null {
  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0]
  return SUPPORTED_LANGS.includes(firstSegment as Lang) ? (firstSegment as Lang) : null
}

/** Guess the language from the browser/system settings. */
function langFromSystem(): Lang {
  const systemLang = (navigator.language || '').toLowerCase()
  return systemLang.startsWith('zh') ? 'cn' : 'en'
}

/** Build a path whose first segment is the language prefix, keeping the rest. */
function pathForLang(lang: Lang): string {
  const segments = window.location.pathname.split('/').filter(Boolean)
  if (SUPPORTED_LANGS.includes(segments[0] as Lang)) {
    segments[0] = lang
  } else {
    segments.unshift(lang)
  }
  return `/${segments.join('/')}${window.location.search}${window.location.hash}`
}

/**
 * Resolve the language for the very first render.
 * - If the URL already carries a /en or /cn prefix, use it.
 * - Otherwise detect the system language and redirect to the matching prefix.
 */
function resolveInitialLang(): Lang {
  const fromPath = langFromPath()
  if (fromPath) return fromPath

  const detected = langFromSystem()
  window.history.replaceState(null, '', pathForLang(detected))
  return detected
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(resolveInitialLang)

  // Keep <html lang> and the document title in sync with the active language.
  useEffect(() => {
    document.documentElement.lang = lang === 'cn' ? 'zh-CN' : 'en'
    document.title = translations[lang].appTitle
  }, [lang])

  // Honour the browser back/forward buttons between /en and /cn.
  useEffect(() => {
    const handlePopState = () => {
      const fromPath = langFromPath()
      if (fromPath) setLangState(fromPath)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState((current) => {
      if (current === next) return current
      window.history.pushState(null, '', pathForLang(next))
      return next
    })
  }, [])

  const t = useCallback<TranslateFn>(
    (key, params) => translate(lang, key, params),
    [lang],
  )

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
