import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './resources/en/common.json'
import zhTwCommon from './resources/zh-TW/common.json'

export const LANGUAGE_STORAGE_KEY = 'lang'
export const FALLBACK_LANGUAGE = 'zh-TW'

const resources = {
  en: { common: enCommon },
  'zh-TW': { common: zhTwCommon },
} as const

const supportedLanguages = Object.keys(resources)

function resolveInitialLanguage(): string {
  if (typeof window === 'undefined') {
    return FALLBACK_LANGUAGE
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored && supportedLanguages.includes(stored)) {
    return stored
  }

  if (stored && !supportedLanguages.includes(stored)) {
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY)
  }

  const navigatorLanguage = window.navigator?.language
  if (navigatorLanguage) {
    if (supportedLanguages.includes(navigatorLanguage)) {
      return navigatorLanguage
    }
    const base = navigatorLanguage.split('-')[0]
    const matched = supportedLanguages.find(language => language.startsWith(base))
    if (matched) {
      return matched
    }
  }

  return FALLBACK_LANGUAGE
}

const initialLanguage = resolveInitialLanguage()

function persistLanguage(language: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language
  }
}

if (!i18next.isInitialized) {
  void i18next
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLanguage,
      fallbackLng: FALLBACK_LANGUAGE,
      supportedLngs: supportedLanguages,
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
      react: {
        useSuspense: false,
      },
    })
    .then(() => {
      persistLanguage(i18next.language)
    })
    .catch(error => {
      if (import.meta.env.DEV) {
        console.error('Failed to initialise i18next', error)
      }
    })
}

const globalScope =
  typeof window !== 'undefined' ? window : (globalThis as unknown as Record<string, unknown>)
const listenerFlag = '__financeAppLanguageListener__'

if (!globalScope[listenerFlag]) {
  i18next.on('languageChanged', persistLanguage)
  globalScope[listenerFlag] = true
  if (i18next.isInitialized) {
    persistLanguage(i18next.language)
  }
}

export const supportedLngs = supportedLanguages

export function getCurrentLocale(): string {
  const locale = i18next.resolvedLanguage || i18next.language
  return locale || FALLBACK_LANGUAGE
}

export default i18next
