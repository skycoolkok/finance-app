import { promises as fs } from 'fs'
import path from 'path'

const rootDir = process.cwd()
const srcDir = path.join(rootDir, 'src')
const localesDir = path.join(srcDir, 'i18n', 'resources')
const targetLocales = ['en', 'zh-TW']

function isTranslationFile(filePath) {
  return targetLocales.some((locale) => filePath.endsWith(path.join(locale, 'common.json')))
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

async function loadLocaleResources() {
  const resources = {}
  const entries = await fs.readdir(localesDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || !targetLocales.includes(entry.name)) {
      continue
    }
    const filePath = path.join(localesDir, entry.name, 'common.json')
    resources[entry.name] = await readJson(filePath)
  }
  return resources
}

async function walkFiles(dir, matcher) {
  const results = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!isTranslationFile(fullPath)) {
        results.push(...(await walkFiles(fullPath, matcher)))
      }
      continue
    }
    if (matcher(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}

function extractTranslationKeys(source) {
  const keys = new Set()
  const regex = /t\(\s*['"]([^'"]+)['"]/g
  let match
  while ((match = regex.exec(source)) !== null) {
    const startIndex = match.index
    const preceding = startIndex > 0 ? source[startIndex - 1] : ''
    if (preceding && /[A-Za-z0-9_]/.test(preceding) && preceding !== '.') {
      continue
    }
    keys.add(match[1])
  }
  return keys
}

function hasPath(resource, keyPath) {
  return keyPath.split('.').every((part) => {
    if (resource && Object.prototype.hasOwnProperty.call(resource, part)) {
      resource = resource[part]
      return true
    }
    return false
  })
}

async function collectUsedKeys() {
  const files = await walkFiles(
    srcDir,
    (name) => name.endsWith('.tsx') || (name.endsWith('.ts') && !name.endsWith('.d.ts')),
  )
  const collected = new Set()
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    const keys = extractTranslationKeys(content)
    for (const key of keys) {
      collected.add(key)
    }
  }
  return collected
}

const resources = await loadLocaleResources()
const usedKeys = await collectUsedKeys()

const missing = {}
for (const locale of targetLocales) {
  missing[locale] = []
  for (const key of usedKeys) {
    if (!hasPath(resources[locale], key)) {
      missing[locale].push(key)
    }
  }
}

const hasMissing = targetLocales.some((locale) => missing[locale].length > 0)

if (hasMissing) {
  for (const locale of targetLocales) {
    if (missing[locale].length === 0) {
      continue
    }
    console.error(`Missing ${locale} translations:`)
    missing[locale].sort().forEach((key) => {
      console.error(`  - ${key}`)
    })
  }
  process.exit(1)
}

console.log('All translation keys are present for en and zh-TW.')
