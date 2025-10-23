import { useMemo, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { auth } from '../firebase'
import { setUserLocale } from '../functions'
import { normalizeLanguageTag } from '../lib/language'

const LANGUAGE_OPTIONS = [
  { value: 'zh-TW', labelKey: 'language.zhTW' },
  { value: 'en', labelKey: 'language.en' },
] as const

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const currentValue = useMemo(
    () => normalizeLanguageTag(i18n.resolvedLanguage || i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  )

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = normalizeLanguageTag(event.target.value)
    const resolvedCurrent = normalizeLanguageTag(i18n.resolvedLanguage || i18n.language)
    if (nextLanguage !== resolvedCurrent) {
      void (async () => {
        await i18n.changeLanguage(nextLanguage)
        const currentUser = auth.currentUser
        if (currentUser) {
          try {
            await setUserLocale({ locale: nextLanguage })
          } catch (error) {
            if (import.meta.env.DEV) {
              console.error('Failed to sync user locale', error)
            }
          }
        }
      })()
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <label htmlFor="language-switcher" className="text-xs uppercase tracking-wide text-slate-500">
        {t('language.label')}
      </label>
      <select
        id="language-switcher"
        value={currentValue}
        onChange={handleChange}
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
      >
        {LANGUAGE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </div>
  )
}

export default LanguageSwitcher
