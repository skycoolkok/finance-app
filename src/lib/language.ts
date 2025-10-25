import { supportedLngs } from '../i18n'
import { FALLBACK_LOCALE, normalizeLocale } from './locale'

export function normalizeLanguageTag(language: string | null | undefined): string {
  const normalized = normalizeLocale(language ?? undefined)
  if (supportedLngs.includes(normalized)) {
    return normalized
  }
  return FALLBACK_LOCALE
}
