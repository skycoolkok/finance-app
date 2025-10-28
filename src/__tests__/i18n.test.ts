import { describe, expect, it } from 'vitest'

import './setup/vite-ssr-export'
import '../i18n/language-utils'

type I18nRegistry = {
  resolveLanguageFromStorage?: typeof import('../i18n/language-utils').resolveLanguageFromStorage
}

const i18nRegistry =
  ((globalThis as Record<string, unknown>).__financeI18n__ as I18nRegistry | undefined) ?? undefined

if (!i18nRegistry || typeof i18nRegistry.resolveLanguageFromStorage !== 'function') {
  throw new Error('resolveLanguageFromStorage export missing for tests')
}

const { resolveLanguageFromStorage } = i18nRegistry

describe('resolveLanguageFromStorage', () => {
  it('normalizes zh variants to zh-TW', () => {
    expect(resolveLanguageFromStorage('zh')).toBe('zh-TW')
    expect(resolveLanguageFromStorage('zh-tw')).toBe('zh-TW')
  })
})
