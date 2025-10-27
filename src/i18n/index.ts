import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './resources/en/common.json'
import zhTwCommon from './resources/zh-TW/common.json'
import { AppLocale, FALLBACK_LOCALE, normalizeLocale, setLocale } from '../lib/locale'
import { resolveLanguageFromStorage } from './language-utils'

const STORAGE_KEY = 'lang' as const

const resources = {
  en: { common: enCommon },
  'zh-TW': { common: zhTwCommon },
} as const

const supportedLanguages = Object.keys(resources) as AppLocale[]

let lastPersistedLanguage: AppLocale | null = null

function readStoredLanguageValue(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function resolveInitialLanguage(): AppLocale {
  return resolveLanguageFromStorage(readStoredLanguageValue())
}

function applyDocumentLanguage(locale: AppLocale) {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.lang = locale
}

function persistLanguage(locale: AppLocale) {
  if (lastPersistedLanguage === locale) {
    return
  }
  lastPersistedLanguage = setLocale(locale)
}

function applyLanguageSideEffects(language: string) {
  const normalized = normalizeLocale(language)
  applyDocumentLanguage(normalized)
  persistLanguage(normalized)
}

const initialLanguage = resolveInitialLanguage()
applyDocumentLanguage(initialLanguage)

if (!i18next.isInitialized) {
  void i18next
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLanguage,
      fallbackLng: 'en',
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
      applyLanguageSideEffects(i18next.language)
    })
    .catch((error) => {
      if (import.meta.env.DEV) {
        console.error('Failed to initialise i18next', error)
      }
    })
} else {
  applyLanguageSideEffects(i18next.language)
}

const globalScope =
  typeof window !== 'undefined' ? window : (globalThis as unknown as Record<string, unknown>)
const listenerFlag = '__financeAppLanguageListener__'

if (!globalScope[listenerFlag]) {
  i18next.on('languageChanged', (language) => {
    applyLanguageSideEffects(language)
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

export { resolveLanguageFromStorage }
