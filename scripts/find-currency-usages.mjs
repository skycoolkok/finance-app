#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])
const IGNORE_PATHS = new Set(['src/lib/money.ts', 'src/i18n/language-utils.ts'])

const findings = []

function walkDirectory(dir) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const relativePath = path.relative(ROOT, fullPath)
    if (relativePath.startsWith('node_modules') || relativePath.startsWith('dist')) {
      continue
    }
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      walkDirectory(fullPath)
    } else if (stats.isFile()) {
      const ext = path.extname(fullPath)
      if (!TARGET_EXTENSIONS.has(ext)) {
        continue
      }
      const normalizedPath = relativePath.replace(/\\/g, '/')
      if (IGNORE_PATHS.has(normalizedPath)) {
        continue
      }
      scanFile(fullPath, normalizedPath)
    }
  }
}

function recordFinding(relativePath, lineNumber, line, reason) {
  findings.push({
    file: relativePath,
    line: lineNumber,
    snippet: line.trim(),
    reason,
  })
}

function scanFile(fullPath, relativePath) {
  const content = readFileSync(fullPath, 'utf8')
  const lines = content.split(/\r?\n/)

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    if (line.includes('Intl.NumberFormat') && content.includes('currency')) {
      recordFinding(relativePath, lineNumber, line, 'Intl.NumberFormat usage')
    } else if (line.includes('.toLocaleString') && line.includes('currency')) {
      recordFinding(relativePath, lineNumber, line, 'toLocaleString currency usage')
    }
  })

  const currencyStyleRegex = /style\s*:\s*['"]currency['"]/
  if (currencyStyleRegex.test(content) && !content.includes('formatCurrency')) {
    const firstMatchIndex = content.search(currencyStyleRegex)
    const beforeMatch = content.slice(0, firstMatchIndex)
    const lineNumber = beforeMatch.split(/\r?\n/).length
    const snippet = lines[lineNumber - 1] ?? ''
    recordFinding(relativePath, lineNumber, snippet, 'currency style detected')
  }
}

const targetDir = path.join(ROOT, 'src')
walkDirectory(targetDir)

if (findings.length === 0) {
  console.log('[OK] No forbidden currency formatting usage found.')
  process.exit(0)
}

console.error('[FAIL] Detected forbidden currency formatting usage:')
for (const finding of findings) {
  console.error(` - ${finding.file}:${finding.line} [${finding.reason}] -> ${finding.snippet}`)
}
process.exit(1)
