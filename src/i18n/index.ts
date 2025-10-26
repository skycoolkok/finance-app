import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './resources/en/common.json'
import zhTwCommon from './resources/zh-TW/common.json'
import { AppLocale, FALLBACK_LOCALE, normalizeLocale, setLocale } from '../lib/locale'

const STORAGE_KEY = 'lang' as const

const resources = {
  en: { common: enCommon },
  'zh-TW': { common: zhTwCommon },
} as const

const supportedLanguages = Object.keys(resources) as AppLocale[]

function readStoredLanguage(): AppLocale | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }
    return normalizeLocale(stored)
  } catch {
    return null
  }
}

function persistLanguage(locale: AppLocale) {
  setLocale(locale)
}

function applyDocumentLanguage(locale: AppLocale) {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.lang = locale
}

const initialLanguage = readStoredLanguage() ?? FALLBACK_LOCALE

function ensureLanguageSideEffects(language: string) {
  const normalized = normalizeLocale(language)
  if (normalized !== language) {
    void i18next.changeLanguage(normalized)
    return
  }
  applyDocumentLanguage(normalized)
  persistLanguage(normalized)
}

if (!i18next.isInitialized) {
  void i18next
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLanguage,
      fallbackLng: FALLBACK_LOCALE,
      supportedLngs: supportedLanguages,
      load: 'currentOnly',
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
      react: {
        useSuspense: false,
      },
    })
    .then(() => {
      ensureLanguageSideEffects(i18next.language)
    })
    .catch(error => {
      if (import.meta.env.DEV) {
        console.error('Failed to initialise i18next', error)
      }
    })
} else {
  ensureLanguageSideEffects(i18next.language)
}

const globalScope =
  typeof window !== 'undefined' ? window : (globalThis as unknown as Record<string, unknown>)
const listenerFlag = '__financeAppLanguageListener__'

if (!globalScope[listenerFlag]) {
  i18next.on('languageChanged', language => {
    ensureLanguageSideEffects(language)
  })
  globalScope[listenerFlag] = true
}

export const supportedLngs = supportedLanguages
export const FALLBACK_LANGUAGE: AppLocale = FALLBACK_LOCALE

export function getCurrentLocale(): AppLocale {
  const locale = i18next.resolvedLanguage || i18next.language
  return normalizeLocale(locale)
}

export default i18next
