import '../lib/vite-ssr-export-shim'
import { FALLBACK_LOCALE, normalizeLocale, type AppLocale } from '../lib/locale'

const scope = globalThis as Record<string, unknown>

const DEFAULT_LANGUAGE: AppLocale = FALLBACK_LOCALE

export function resolveLanguageFromStorage(value: string | null): AppLocale {
  if (!value) {
    return DEFAULT_LANGUAGE
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return DEFAULT_LANGUAGE
  }

  const lower = trimmed.toLowerCase()

  if (lower === 'zh' || lower === 'zh-tw') {
    return 'zh-TW'
  }

  if (lower === 'en') {
    return 'en'
  }

  if (trimmed === 'zh-TW') {
    return 'zh-TW'
  }

  return normalizeLocale(trimmed)
}

export { DEFAULT_LANGUAGE }

const registryKey = '__financeI18n__'
const registry =
  (scope[registryKey] as Record<string, unknown> | undefined) ?? ({} as Record<string, unknown>)
registry.resolveLanguageFromStorage = resolveLanguageFromStorage
scope[registryKey] = registry
