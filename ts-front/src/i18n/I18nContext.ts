import { createContext, useContext } from 'react'
import type { Lang, TranslationKey, Translations } from './translations'

export type ParamsFor<K extends TranslationKey> = Translations[K] extends (p: infer P) => string
  ? P
  : undefined

export type TranslateFn = <K extends TranslationKey>(key: K, params?: ParamsFor<K>) => string

export type I18nContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TranslateFn
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
