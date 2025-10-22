import { useMemo, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { FALLBACK_LANGUAGE, supportedLngs } from '../i18n'

const LANGUAGE_OPTIONS = [
  { value: 'zh-TW', labelKey: 'language.zhTW' },
  { value: 'en', labelKey: 'language.en' },
] as const

function normaliseLanguage(language: string | undefined) {
  if (!language) {
    return FALLBACK_LANGUAGE
  }
  const directMatch = supportedLngs.find(item => item === language)
  if (directMatch) {
    return directMatch
  }
  const prefixMatch = supportedLngs.find(item => language.startsWith(item.split('-')[0]))
  return prefixMatch ?? FALLBACK_LANGUAGE
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const currentValue = useMemo(
    () => normaliseLanguage(i18n.resolvedLanguage || i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  )

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = event.target.value
    if (nextLanguage !== i18n.language) {
      void i18n.changeLanguage(nextLanguage)
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
