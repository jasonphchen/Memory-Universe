import { useI18n } from '../i18n/I18nContext'

/**
 * Renders just the language buttons (no pill wrapper) so it can sit inside
 * the shared bottom-left control bar next to the font-size switch.
 */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()

  return (
    <div className="switch-group" role="group" aria-label={t('switchLanguage')}>
      <button
        type="button"
        className={`font-mode-option${lang === 'en' ? ' is-active' : ''}`}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        {t('languageLabelEn')}
      </button>
      <button
        type="button"
        className={`font-mode-option${lang === 'cn' ? ' is-active' : ''}`}
        aria-pressed={lang === 'cn'}
        onClick={() => setLang('cn')}
      >
        {t('languageLabelCn')}
      </button>
    </div>
  )
}
