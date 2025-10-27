import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import i18next from 'i18next'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import './setup/vite-ssr-export'
vi.mock('../lib/locale', () => ({
  FALLBACK_LOCALE: 'zh-TW',
  normalizeLocale: (value: string | undefined) => {
    if (!value) {
      return 'zh-TW'
    }
    const lower = value.toLowerCase()
    if (lower.startsWith('en')) {
      return 'en'
    }
    if (lower === 'zh' || lower === 'zh-tw') {
      return 'zh-TW'
    }
    return 'zh-TW'
  },
  setLocale: (locale: string) => locale,
}))
import '../i18n/language-utils'

const testI18n = i18next.createInstance()
const currentDir = path.dirname(fileURLToPath(import.meta.url))

function loadJson(relativePath: string) {
  const filePath = path.resolve(currentDir, relativePath)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

const enCommon = loadJson('../i18n/resources/en/common.json')
const zhTwCommon = loadJson('../i18n/resources/zh-TW/common.json')

describe('i18n resources', () => {
  beforeAll(async () => {
    await testI18n.init({
      resources: {
        en: { common: enCommon },
        'zh-TW': { common: zhTwCommon },
      },
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: 'common',
      interpolation: { escapeValue: false },
    })
  })

  it("returns zh-TW text for nav.dashboard when language is 'zh-TW'", async () => {
    await testI18n.changeLanguage('zh-TW')
    expect(testI18n.t('nav.dashboard')).toBe(zhTwCommon.nav.dashboard)
  })

  it("returns en text for nav.dashboard when language is 'en'", async () => {
    await testI18n.changeLanguage('en')
    expect(testI18n.t('nav.dashboard')).toBe(enCommon.nav.dashboard)
  })
})

describe('resolveLanguageFromStorage', () => {
  type LanguageRegistry = {
    resolveLanguageFromStorage?: (value: string | null) => string
  }

  let resolveLanguageFromStorage: (value: string | null) => string

  beforeAll(() => {
    const registry = (globalThis as Record<string, unknown>).__financeI18n__ as
      | LanguageRegistry
      | undefined
    if (!registry?.resolveLanguageFromStorage) {
      throw new Error('resolveLanguageFromStorage registry missing')
    }
    resolveLanguageFromStorage = registry.resolveLanguageFromStorage
  })

  it('defaults to zh-TW when storage value is missing', () => {
    expect(resolveLanguageFromStorage(null)).toBe('zh-TW')
    expect(resolveLanguageFromStorage('')).toBe('zh-TW')
  })

  it('normalises zh variants to zh-TW', () => {
    expect(resolveLanguageFromStorage('zh')).toBe('zh-TW')
    expect(resolveLanguageFromStorage('zh-tw')).toBe('zh-TW')
    expect(resolveLanguageFromStorage('ZH-TW')).toBe('zh-TW')
  })

  it('returns en for english selections', () => {
    expect(resolveLanguageFromStorage('en')).toBe('en')
    expect(resolveLanguageFromStorage('en-US')).toBe('en')
  })

  it('falls back to zh-TW for unknown values', () => {
    expect(resolveLanguageFromStorage('fr')).toBe('zh-TW')
  })
})
