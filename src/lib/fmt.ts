import { getCurrentLocale, normalizeLocale, FALLBACK_LOCALE } from './locale'
import type { AppLocale } from './locale'

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()

type DateLike = Date | string | number | null | undefined

function resolveLocale(explicit?: string): AppLocale {
  if (explicit) {
    return normalizeLocale(explicit)
  }
  return getCurrentLocale() ?? FALLBACK_LOCALE
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

export function formatDate(
  value: DateLike,
  locale?: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
): string {
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

  const resolvedLocale = resolveLocale(locale)
  return getDateFormatter(resolvedLocale, options).format(date)
}

export const date = formatDate
