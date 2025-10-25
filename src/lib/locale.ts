import { useSyncExternalStore } from 'react'

export type AppLocale = 'en' | 'zh-TW'

export type PreferenceChangeDetail =
  | { type: 'locale'; value: AppLocale }
  | { type: 'currency'; value: string }

export const PREFERENCE_CHANGE_EVENT = 'app:pref-changed'

const LOCALE_STORAGE_KEY = 'app:locale'
const FALLBACK_LOCALE: AppLocale = 'en'

const ZH_VARIANTS = new Set([
  'zh',
  'zh-tw',
  'zh_tw',
  'zh-hant',
  'zh_hant',
  'zh-hant-tw',
  'zh_hant_tw',
])

let cachedLocale: AppLocale | null = null
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach(listener => {
    listener()
  })
}

function dispatchPreferenceChange(detail: PreferenceChangeDetail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return
  }
  try {
    window.dispatchEvent(new CustomEvent(PREFERENCE_CHANGE_EVENT, { detail }))
  } catch {
    // ignore environments without CustomEvent support
  }
}

function readStoredLocale(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

function readNavigatorLocale(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  const nav = window.navigator
  return nav?.language ?? null
}

function storeLocale(locale: AppLocale) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // ignore persistence failures (e.g. private mode)
  }
}

export function normalizeLocale(input: string | undefined): AppLocale {
  if (!input) {
    return FALLBACK_LOCALE
  }

  const canonical = input.trim().replace('_', '-')
  if (!canonical) {
    return FALLBACK_LOCALE
  }

  const lower = canonical.toLowerCase()
  if (ZH_VARIANTS.has(lower)) {
    return 'zh-TW'
  }

  return 'en'
}

export function getCurrentLocale(): AppLocale {
  if (cachedLocale) {
    return cachedLocale
  }

  const stored = readStoredLocale()
  if (stored) {
    cachedLocale = normalizeLocale(stored)
    return cachedLocale
  }

  const navigatorLocale = readNavigatorLocale()
  cachedLocale = normalizeLocale(navigatorLocale ?? undefined)
  return cachedLocale
}

export function setLocale(locale: string | AppLocale): AppLocale {
  const normalized = normalizeLocale(locale)
  cachedLocale = normalized
  storeLocale(normalized)
  notifyListeners()
  dispatchPreferenceChange({ type: 'locale', value: normalized })
  return normalized
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== LOCALE_STORAGE_KEY) {
      return
    }
    const nextLocale = normalizeLocale(event.newValue ?? undefined)
    if (cachedLocale === nextLocale) {
      return
    }
    cachedLocale = nextLocale
    notifyListeners()
  })

  window.addEventListener(PREFERENCE_CHANGE_EVENT, event => {
    const custom = event as CustomEvent<PreferenceChangeDetail>
    if (custom.detail?.type !== 'locale') {
      return
    }
    const detailLocale = normalizeLocale(custom.detail.value)
    if (cachedLocale === detailLocale) {
      return
    }
    cachedLocale = detailLocale
    storeLocale(detailLocale)
    notifyListeners()
  })
}

export function useLocale(): AppLocale {
  return useSyncExternalStore(subscribe, getCurrentLocale, getCurrentLocale)
}

export function getLocaleStorageKey(): string {
  return LOCALE_STORAGE_KEY
}

export { FALLBACK_LOCALE }
export { dispatchPreferenceChange }
