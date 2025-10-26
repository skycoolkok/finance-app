import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

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
    expect(testI18n.t('nav.dashboard')).toBe('儀表板')
  })

  it("returns en text for nav.dashboard when language is 'en'", async () => {
    await testI18n.changeLanguage('en')
    expect(testI18n.t('nav.dashboard')).toBe('Dashboard')
  })
})
