import { supportedLngs } from '../i18n'
import { FALLBACK_LOCALE, normalizeLocale, type AppLocale } from './locale'

export function normalizeLanguageTag(language: string | null | undefined): AppLocale {
  const normalized = normalizeLocale(language ?? undefined)
  if (supportedLngs.includes(normalized)) {
    return normalized
  }
  return FALLBACK_LOCALE
}
