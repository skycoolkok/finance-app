import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './resources/en/common.json'
import zhTwCommon from './resources/zh-TW/common.json'
import {
  FALLBACK_LOCALE,
  AppLocale,
  getCurrentLocale as getStoredLocale,
  normalizeLocale,
  setLocale,
} from '../lib/locale'

const resources = {
  en: { common: enCommon },
  'zh-TW': { common: zhTwCommon },
} as const

const supportedLanguages = Object.keys(resources) as AppLocale[]
const initialLanguage = getStoredLocale()

function applyDocumentLanguage(locale: AppLocale) {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.lang = locale
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
      applyDocumentLanguage(normalizeLocale(i18next.language))
      setLocale(i18next.language)
    })
    .catch(error => {
      if (import.meta.env.DEV) {
        console.error('Failed to initialise i18next', error)
      }
    })
} else {
  applyDocumentLanguage(normalizeLocale(i18next.language))
  setLocale(i18next.language)
}

const globalScope =
  typeof window !== 'undefined' ? window : (globalThis as unknown as Record<string, unknown>)
const listenerFlag = '__financeAppLanguageListener__'

if (!globalScope[listenerFlag]) {
  i18next.on('languageChanged', language => {
    const normalized = normalizeLocale(language)
    if (language !== normalized) {
      void i18next.changeLanguage(normalized)
      return
    }
    applyDocumentLanguage(normalized)
    setLocale(normalized)
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
