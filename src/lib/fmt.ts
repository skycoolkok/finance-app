import { FALLBACK_LANGUAGE, getCurrentLocale } from '../i18n'

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()

type DateLike = Date | string | number | null | undefined

function normalizeLocale(locale: string): string {
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

function resolveLocale(explicit?: string): string {
  if (explicit) {
    return normalizeLocale(explicit)
  }
  return normalizeLocale(getCurrentLocale())
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
