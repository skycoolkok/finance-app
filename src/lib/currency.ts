import { useSyncExternalStore } from 'react'

import {
  AppLocale,
  PREFERENCE_CHANGE_EVENT,
  PreferenceChangeDetail,
  dispatchPreferenceChange,
  getCurrentLocale,
  normalizeLocale,
} from './locale'

export type Currency = 'USD' | 'TWD'

type FormatMoneyOptions = {
  currency?: Currency
  locale?: string
}

const CURRENCY_STORAGE_KEY = 'app:currency'
const DEFAULT_CURRENCY: Currency = 'USD'

const LOCALE_CURRENCY_MAP: Record<AppLocale, Currency> = {
  en: 'USD',
  'zh-TW': 'TWD',
}

const listeners = new Set<() => void>()
const formatterCache = new Map<string, Intl.NumberFormat>()

let cachedCurrency: Currency | null = null

function normalizeCurrency(value: string | null | undefined): Currency | null {
  if (!value) {
    return null
  }
  const trimmed = value.trim().toUpperCase()
  if (trimmed === 'USD' || trimmed === 'TWD') {
    return trimmed
  }
  return null
}

function readStoredCurrency(): Currency | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return normalizeCurrency(window.localStorage.getItem(CURRENCY_STORAGE_KEY))
  } catch {
    return null
  }
}

function persistCurrency(currency: Currency) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency)
  } catch {
    // ignore persistence errors (e.g. private mode)
  }
}

function deriveCurrencyFromLocale(locale: AppLocale): Currency {
  return LOCALE_CURRENCY_MAP[locale] ?? DEFAULT_CURRENCY
}

function notifyCurrencySubscribers() {
  listeners.forEach(listener => {
    listener()
  })
}

function ensureCurrency(): Currency {
  if (cachedCurrency) {
    return cachedCurrency
  }

  const stored = readStoredCurrency()
  if (stored) {
    cachedCurrency = stored
    return cachedCurrency
  }

  const derived = deriveCurrencyFromLocale(getCurrentLocale())
  cachedCurrency = derived
  persistCurrency(derived)
  return cachedCurrency
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== CURRENCY_STORAGE_KEY) {
      return
    }
    const next = normalizeCurrency(event.newValue)
    if (!next || cachedCurrency === next) {
      return
    }
    cachedCurrency = next
    notifyCurrencySubscribers()
  })

  window.addEventListener(PREFERENCE_CHANGE_EVENT, event => {
    const custom = event as CustomEvent<PreferenceChangeDetail>
    if (custom.detail?.type !== 'currency') {
      return
    }
    const next = normalizeCurrency(custom.detail.value)
    if (!next || cachedCurrency === next) {
      return
    }
    cachedCurrency = next
    persistCurrency(next)
    notifyCurrencySubscribers()
  })
}

export function getCurrency(): Currency {
  return ensureCurrency()
}

export function setCurrency(currency: Currency | string): Currency | null {
  const normalized = normalizeCurrency(currency)
  if (!normalized) {
    return null
  }

  if (cachedCurrency === normalized) {
    persistCurrency(normalized)
    return normalized
  }

  cachedCurrency = normalized
  persistCurrency(normalized)
  notifyCurrencySubscribers()
  dispatchPreferenceChange({ type: 'currency', value: normalized })
  return normalized
}

function getFormatter(locale: AppLocale, currency: Currency): Intl.NumberFormat {
  const key = `${locale}:${currency}`
  const cachedFormatter = formatterCache.get(key)
  if (cachedFormatter) {
    return cachedFormatter
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  })
  formatterCache.set(key, formatter)
  return formatter
}

export function formatMoney(value: number, options?: FormatMoneyOptions): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return ''
  }

  const currency = options?.currency ?? getCurrency()
  const locale = options?.locale ? normalizeLocale(options.locale) : getCurrentLocale()

  try {
    return getFormatter(locale, currency).format(value)
  } catch {
    return value.toFixed(2)
  }
}

export function useCurrency(): Currency {
  return useSyncExternalStore(subscribe, getCurrency, getCurrency)
}
