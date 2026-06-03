import { useI18n } from '../i18n/I18nContext'

/**
 * A single square toggle button that flips between the two supported languages.
 * Sits inside the shared bottom-left control dock next to the theme and
 * font-size buttons.
 */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()

  return (
    <button
      type="button"
      className="control-button"
      aria-label={t('switchLanguage')}
      title={t('switchLanguage')}
      onClick={() => setLang(lang === 'en' ? 'cn' : 'en')}
    >
      {lang === 'en' ? 'EN' : '中'}
    </button>
  )
}
