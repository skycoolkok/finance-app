import { FALLBACK_LANGUAGE, supportedLngs } from '../i18n'

export function normalizeLanguageTag(language: string | null | undefined): string {
  if (!language) {
    return FALLBACK_LANGUAGE
  }

  const trimmed = language.trim()
  if (!trimmed) {
    return FALLBACK_LANGUAGE
  }

  if (supportedLngs.includes(trimmed)) {
    return trimmed
  }

  const base = trimmed.split('-')[0]
  const matched = supportedLngs.find(item => item.split('-')[0] === base)
  return matched ?? FALLBACK_LANGUAGE
}

