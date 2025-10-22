import i18next from '../i18n'
import { FALLBACK_LANGUAGE, LANGUAGE_STORAGE_KEY } from '../i18n'

const DEFAULT_CURRENCY = 'TWD'
const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }

const currencyFormatterCache = new Map<string, Intl.NumberFormat>()
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()

function resolveLocale(explicit?: string): string {
  if (explicit) {
    return explicit
  }

  const fromI18n = i18next.resolvedLanguage || i18next.language
  if (fromI18n) {
    return fromI18n
  }

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored) {
      return stored
    }
  }

  return FALLBACK_LANGUAGE
}

function normaliseLocale(locale: string): string {
  if (!locale) {
    return FALLBACK_LANGUAGE
  }
  if (locale === 'zh' || locale.startsWith('zh-')) {
    return 'zh-TW'
  }
  if (locale.startsWith('en')) {
    return 'en'
  }
  return locale
}

function buildCurrencyOptions(
  locale: string,
  overrides?: Intl.NumberFormatOptions,
): Intl.NumberFormatOptions {
  const base: Intl.NumberFormatOptions =
    locale === 'zh-TW'
      ? { style: 'currency', currency: DEFAULT_CURRENCY, currencyDisplay: 'symbol' }
      : { style: 'currency', currency: DEFAULT_CURRENCY, currencyDisplay: 'code' }

  return { ...base, ...overrides }
}

function getCurrencyFormatter(locale: string, options: Intl.NumberFormatOptions) {
  const cacheKey = `${locale}-${JSON.stringify(options)}`
  const cached = currencyFormatterCache.get(cacheKey)
  if (cached) {
    return cached
  }
  const formatter = new Intl.NumberFormat(locale, options)
  currencyFormatterCache.set(cacheKey, formatter)
  return formatter
}

function getDateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const cacheKey = `${locale}-${JSON.stringify(options)}`
  const cached = dateFormatterCache.get(cacheKey)
  if (cached) {
    return cached
  }
  const formatter = new Intl.DateTimeFormat(locale, options)
  dateFormatterCache.set(cacheKey, formatter)
  return formatter
}

export function currency(
  value: number | bigint,
  localeOrOptions?: string | Intl.NumberFormatOptions,
  maybeOptions?: Intl.NumberFormatOptions,
) {
  if (typeof value !== 'number' && typeof value !== 'bigint') {
    return ''
  }

  const locale =
    typeof localeOrOptions === 'string'
      ? normaliseLocale(resolveLocale(localeOrOptions))
      : normaliseLocale(resolveLocale(undefined))

  const options =
    (typeof localeOrOptions === 'object'
      ? buildCurrencyOptions(locale, localeOrOptions)
      : buildCurrencyOptions(locale, maybeOptions)) ?? buildCurrencyOptions(locale)

  return getCurrencyFormatter(locale, options).format(value)
}

type DateLike = Date | string | number | null | undefined

export function formatDate(
  value: DateLike,
  locale?: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
) {
  if (value === null || value === undefined) {
    return ''
  }

  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value)
        : new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const resolvedLocale = normaliseLocale(resolveLocale(locale))
  return getDateFormatter(resolvedLocale, options).format(date)
}

export const date = formatDate
