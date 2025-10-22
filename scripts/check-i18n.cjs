#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const srcDir = path.join(projectRoot, 'src')
const resourcesDir = path.join(srcDir, 'i18n', 'resources')

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

function flattenKeys(node, prefix = '') {
  if (node === null || node === undefined) {
    return [prefix.slice(1)]
  }

  if (typeof node !== 'object') {
    return [prefix.slice(1)]
  }

  const keys = []
  for (const [key, value] of Object.entries(node)) {
    keys.push(...flattenKeys(value, `${prefix}.${key}`))
  }
  return keys
}

function collectLocaleKeys() {
  const locales = fs.readdirSync(resourcesDir).filter(entry => {
    const localePath = path.join(resourcesDir, entry)
    return fs.statSync(localePath).isDirectory()
  })

  const localeKeyMap = new Map()

  for (const locale of locales) {
    const filePath = path.join(resourcesDir, locale, 'common.json')
    const data = readJson(filePath)
    const keys = flattenKeys(data)
    localeKeyMap.set(locale, new Set(keys))
  }

  return localeKeyMap
}

function collectUsedKeys() {
  const filesToScan = []

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name))
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        filesToScan.push(path.join(dir, entry.name))
      }
    }
  }

  walk(srcDir)

  const keyPattern = /\b(?:i18n\.)?t\(\s*['"`]([^'"`]+)['"`]/g
  const usedKeys = new Set()

  for (const filePath of filesToScan) {
    const content = fs.readFileSync(filePath, 'utf8')
    let match
    while ((match = keyPattern.exec(content)) !== null) {
      const key = match[1]
      if (key.includes('${')) {
        continue
      }
      usedKeys.add(key)
    }
  }

  return usedKeys
}

function main() {
  const localeKeyMap = collectLocaleKeys()
  const locales = Array.from(localeKeyMap.keys())

  if (locales.length === 0) {
    console.error('No locale resources found in', resourcesDir)
    process.exit(1)
  }

  const [primaryLocale, ...restLocales] = locales
  const primaryKeys = localeKeyMap.get(primaryLocale)

  const localeErrors = []

  for (const locale of restLocales) {
    const keys = localeKeyMap.get(locale)
    const missing = [...primaryKeys].filter(key => !keys.has(key))
    const extra = [...keys].filter(key => !primaryKeys.has(key))

    if (missing.length > 0) {
      localeErrors.push(
        `Locale "${locale}" is missing keys defined in "${primaryLocale}":\n  - ${missing.join(
          '\n  - ',
        )}`,
      )
    }

    if (extra.length > 0) {
      localeErrors.push(
        `Locale "${locale}" has extra keys not present in "${primaryLocale}":\n  - ${extra.join(
          '\n  - ',
        )}`,
      )
    }
  }

  const usedKeys = collectUsedKeys()
  const missingByLocale = new Map()

  for (const locale of locales) {
    const keys = localeKeyMap.get(locale)
    const missing = [...usedKeys].filter(key => !keys.has(key))
    if (missing.length > 0) {
      missingByLocale.set(locale, missing)
    }
  }

  const messages = []

  if (localeErrors.length > 0) {
    messages.push(...localeErrors)
  }

  if (missingByLocale.size > 0) {
    for (const [locale, keys] of missingByLocale.entries()) {
      messages.push(
        `Locale "${locale}" is missing translation keys referenced in code:\n  - ${keys.join(
          '\n  - ',
        )}`,
      )
    }
  }

  if (messages.length > 0) {
    console.error(messages.join('\n\n'))
    process.exit(1)
  }

  console.log(`i18n check passed for locales: ${locales.join(', ')}`)
}

main()
