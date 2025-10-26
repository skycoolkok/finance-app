import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { auth } from '../firebase'
import { setUserLocale } from '../functions'
import { normalizeLanguageTag } from '../lib/language'
import type { AppLocale } from '../lib/locale'

const LANGUAGE_OPTIONS = [
  { value: 'zh-TW', labelKey: 'language.zhTW' },
  { value: 'en', labelKey: 'language.en' },
] as const

const SUPPORTED_LANGUAGES: ReadonlySet<AppLocale> = new Set(['zh-TW', 'en'])
const isDev = import.meta.env.DEV

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [hasServiceWorker, setHasServiceWorker] = useState(false)

  const currentValue = useMemo(
    () => normalizeLanguageTag(i18n.resolvedLanguage || i18n.language) as AppLocale,
    [i18n.language, i18n.resolvedLanguage],
  )

  useEffect(() => {
    if (!isDev || typeof navigator === 'undefined' || !navigator.serviceWorker) {
      return
    }
    let cancelled = false
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        if (!cancelled) {
          setHasServiceWorker(registrations.length > 0)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasServiceWorker(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persistLanguageSelection = useCallback((language: AppLocale) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('lang', language)
      } catch {
        // ignore persistence failures (e.g. private browsing)
      }
    }
  }, [])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const proposedLanguage = normalizeLanguageTag(event.target.value) as AppLocale
      if (!SUPPORTED_LANGUAGES.has(proposedLanguage)) {
        if (import.meta.env.DEV) {
          console.warn('Unsupported language selection ignored:', proposedLanguage)
        }
        return
      }
      if (proposedLanguage === currentValue) {
        return
      }

      void (async () => {
        try {
          await i18n.changeLanguage(proposedLanguage)
          persistLanguageSelection(proposedLanguage)
          const currentUser = auth.currentUser
          if (currentUser) {
            try {
              await setUserLocale({ locale: proposedLanguage })
            } catch (error) {
              if (import.meta.env.DEV) {
                console.error('Failed to sync user locale', error)
              }
            }
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Failed to change language', error)
          }
        }
      })()
    },
    [currentValue, i18n, persistLanguageSelection],
  )

  const handleResetLanguage = useCallback(async () => {
    if (!isDev || typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.removeItem('lang')
    } catch {
      // ignore storage errors
    }

    if (hasServiceWorker && typeof navigator !== 'undefined' && navigator.serviceWorker) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Service worker unregister failed', error)
        }
      }
    }

    window.location.reload()
  }, [hasServiceWorker])

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
      <label htmlFor="language-switcher" className="text-xs uppercase tracking-wide text-slate-500">
        {t('language.label')}
      </label>
      <select
        id="language-switcher"
        value={currentValue}
        onChange={handleChange}
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
      <span className="rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
        {currentValue}
      </span>
      {isDev && (
        <button
          type="button"
          onClick={() => {
            void handleResetLanguage()
          }}
          className="rounded border border-amber-500 px-2 py-1 text-xs font-medium text-amber-400 transition hover:bg-amber-500/10"
        >
          {t('language.reset')}
        </button>
      )}
    </div>
  )
}

export default LanguageSwitcher
