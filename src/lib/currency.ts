import { useSyncExternalStore } from 'react'

import { FALLBACK_LANGUAGE, getCurrentLocale } from '../i18n'

const CURRENCY_STORAGE_KEY = 'app:currency'
const CURRENCY_CHANGE_EVENT = 'app:currency-change'

const LOCALE_CURRENCY_MAP: Record<string, string> = {
  'zh-TW': 'TWD',
  en: 'USD',
}

const DEFAULT_CURRENCY = 'USD'

const listeners = new Set<() => void>()
const formatterCache = new Map<string, Intl.NumberFormat>()

let cachedCurrency: string | null = null

type FormatMoneyOptions = {
  currency?: string
  locale?: string
}

function normalizeCurrencyCode(code: string | null | undefined): string | null {
  if (!code) {
    return null
  }
  const trimmed = code.trim().toUpperCase()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeLocale(locale: string | null | undefined): string {
  if (!locale) {
    return FALLBACK_LANGUAGE
  }

  const trimmed = locale.trim()
  if (!trimmed) {
    return FALLBACK_LANGUAGE
  }

  const lower = trimmed.toLowerCase()
  if (lower === 'zh' || lower.startsWith('zh-')) {
    return 'zh-TW'
  }
  if (lower === 'en' || lower.startsWith('en-')) {
    return 'en'
  }

  return trimmed
}

function deriveCurrencyFromLocale(locale: string): string {
  const normalisedLocale = normalizeLocale(locale)
  if (LOCALE_CURRENCY_MAP[normalisedLocale]) {
    return LOCALE_CURRENCY_MAP[normalisedLocale]
  }

  const base = normalisedLocale.split('-')[0]
  const matched = Object.entries(LOCALE_CURRENCY_MAP).find(([key]) => key.startsWith(base))
  return matched ? matched[1] : DEFAULT_CURRENCY
}

function readStoredCurrency(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(CURRENCY_STORAGE_KEY)
  } catch {
    return null
  }
}

function persistCurrency(currency: string) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency)
  } catch {
    // ignore persistence errors (e.g. private mode)
  }
}

function notifyCurrencyChange() {
  listeners.forEach(listener => listener())
  if (typeof window !== 'undefined') {
    try {
      const event = new CustomEvent<string>(CURRENCY_CHANGE_EVENT, {
        detail: cachedCurrency ?? undefined,
      })
      window.dispatchEvent(event)
    } catch {
      // ignore dispatch errors
    }
  }
}

function ensureCachedCurrency(): string {
  if (cachedCurrency) {
    return cachedCurrency
  }

  const stored = normalizeCurrencyCode(readStoredCurrency())
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
    if (event.key === CURRENCY_STORAGE_KEY) {
      const next = normalizeCurrencyCode(event.newValue)
      if (next) {
        cachedCurrency = next
        notifyCurrencyChange()
      }
    }
  })
}

export function getCurrency(): string {
  return ensureCachedCurrency()
}

export function setCurrency(currency: string): void {
  const normalized = normalizeCurrencyCode(currency)
  if (!normalized) {
    return
  }

  if (cachedCurrency === normalized) {
    persistCurrency(normalized)
    return
  }

  cachedCurrency = normalized
  persistCurrency(normalized)
  notifyCurrencyChange()
}

function getFormatter(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`
  const cachedFormatter = formatterCache.get(key)
  if (cachedFormatter) {
    return cachedFormatter
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
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

export function useCurrency(): string {
  return useSyncExternalStore(subscribe, getCurrency, getCurrency)
}

export const currencyChangeEvent = CURRENCY_CHANGE_EVENT
