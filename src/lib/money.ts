import type { PreferenceChangeDetail } from './locale'
import { dispatchPreferenceChange } from './locale'
import type { CurrencyCode } from './currencyCodes'

export { SUPPORTED_CURRENCIES } from './currencyCodes'
export type { CurrencyCode } from './currencyCodes'

export const currencyLabel: Record<CurrencyCode, Record<'en' | 'zh-TW', string>> = {
  TWD: { en: 'NT$', 'zh-TW': 'NT$' },
  USD: { en: '$', 'zh-TW': 'US$' },
  EUR: { en: '€', 'zh-TW': '€' },
  GBP: { en: '£', 'zh-TW': '£' },
  JPY: { en: '¥', 'zh-TW': '¥' },
  KRW: { en: '₩', 'zh-TW': '₩' },
}

export type Rates = Partial<Record<CurrencyCode, number>>
export type RateProvider = { getRates(): Promise<Rates> }

const STORAGE_KEY = 'preferredCurrency'
const LANGUAGE_STORAGE_KEY = 'lang'
const DEFAULT_CURRENCY: CurrencyCode = 'TWD'

export const fallbackRates: Rates = {
  TWD: 1,
  USD: 0,
  EUR: 0,
  GBP: 0,
  JPY: 0,
  KRW: 0,
}

function normalizeLanguage(language: string | undefined): 'en' | 'zh-TW' {
  if (!language) {
    return 'zh-TW'
  }
  const lower = language.toLowerCase()
  if (lower === 'zh' || lower === 'zh-tw') {
    return 'zh-TW'
  }
  return 'en'
}

function readStoredLanguage(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    return null
  }
}

function currentLanguage(): 'en' | 'zh-TW' {
  const stored = readStoredLanguage()
  return normalizeLanguage(stored ?? undefined)
}

export function normalizeCurrency(value: unknown): CurrencyCode {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase()
    switch (upper) {
      case 'TWD':
      case 'USD':
      case 'EUR':
      case 'GBP':
      case 'JPY':
      case 'KRW':
        return upper as CurrencyCode
      default:
        break
    }
  }
  return DEFAULT_CURRENCY
}

export function readStoredCurrency(): CurrencyCode {
  if (typeof window === 'undefined') {
    return DEFAULT_CURRENCY
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_CURRENCY
    }
    return normalizeCurrency(raw)
  } catch {
    return DEFAULT_CURRENCY
  }
}

export function persistCurrency(currency: CurrencyCode) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, currency)
  } catch {
    // ignore persistence errors (e.g. private mode)
  }
  dispatchPreferenceChange({ type: 'currency', value: currency } satisfies PreferenceChangeDetail)
}

export function currentCurrency(): CurrencyCode {
  return readStoredCurrency()
}

export type FormatCurrencyOptions = {
  currency?: CurrencyCode
  lng?: 'en' | 'zh-TW'
  rates?: Rates
  maximumFractionDigits?: number
}

export function formatCurrency(valueTwd: number, opts?: FormatCurrencyOptions) {
  if (typeof valueTwd !== 'number' || Number.isNaN(valueTwd)) {
    return ''
  }

  const currency = opts?.currency ? normalizeCurrency(opts.currency) : currentCurrency()
  const lng = normalizeLanguage(opts?.lng ?? currentLanguage())
  const rates = { ...fallbackRates, ...(opts?.rates || {}) }
  const rate = rates[currency]
  const shouldConvert = typeof rate === 'number' && rate > 0
  const max = opts?.maximumFractionDigits ?? (currency === 'JPY' || currency === 'KRW' ? 0 : 2)

  const value = shouldConvert ? valueTwd * rate : valueTwd
  const formatter = new Intl.NumberFormat(lng, {
    maximumFractionDigits: max,
    minimumFractionDigits: 0,
  })
  const num = formatter.format(value)
  const label = currencyLabel[currency]?.[lng] ?? currency
  return `${label} ${num}`
}

const globalMoneyRegistryKey = '__financeMoney__'
const globalScope =
  typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : undefined
if (globalScope) {
  const registry =
    (globalScope[globalMoneyRegistryKey] as Record<string, unknown> | undefined) ?? {}
  registry.formatCurrency = formatCurrency
  registry.normalizeCurrency = normalizeCurrency
  registry.readStoredCurrency = readStoredCurrency
  globalScope[globalMoneyRegistryKey] = registry
}
