import { readFile } from 'node:fs/promises'
import path from 'node:path'

import Handlebars from 'handlebars'
import mjml2html from 'mjml'

type TemplateKind = 'email'
type Variant = 'A' | 'B'
type AppLocale = 'en' | 'zh-TW'

type CacheEntry = {
  type: 'mjml' | 'hbs'
  compile: HandlebarsTemplateDelegate
}

type RenderEmailOptions = {
  locale: string
  variant?: Variant
  templateName?: TemplateKind
  context: Record<string, unknown>
}

const TEMPLATE_CACHE = new Map<string, CacheEntry>()

export async function renderEmailTemplate(options: RenderEmailOptions): Promise<string> {
  const locale = normaliseLocale(options.locale)
  const variant = options.variant ?? 'A'
  const templateName = options.templateName ?? 'email'

  const candidateFiles = buildCandidateList(locale, templateName, variant)

  for (const candidate of candidateFiles) {
    const cached = TEMPLATE_CACHE.get(candidate.cacheKey)
    if (cached) {
      return renderFromCache(cached, options.context)
    }

    const template = await tryLoadTemplate(candidate.filePath)
    if (!template) {
      continue
    }

    const compile = Handlebars.compile(template, { noEscape: false })
    const type = candidate.extension === '.mjml' ? 'mjml' : 'hbs'
    const entry: CacheEntry = { type, compile }
    TEMPLATE_CACHE.set(candidate.cacheKey, entry)
    return renderFromCache(entry, options.context)
  }

  throw new Error(
    `Email template not found for locale "${locale}" (variant ${variant}, template ${templateName}).`,
  )
}

function renderFromCache(entry: CacheEntry, context: Record<string, unknown>): string {
  const templated = entry.compile(context)
  if (entry.type === 'mjml') {
    const result = mjml2html(templated, {
      minify: true,
      validationLevel: 'soft',
    })
    if (result.errors?.length) {
      throw new Error(
        `MJML render failed: ${result.errors.map((error) => error.formattedMessage).join('; ')}`,
      )
    }
    return result.html
  }
  return templated
}

type CandidateEntry = {
  cacheKey: string
  filePath: string
  extension: '.mjml' | '.hbs'
}

function buildCandidateList(locale: AppLocale, template: TemplateKind, variant: Variant) {
  const filenames: CandidateEntry[] = []

  const basePaths = [
    path.join(getTemplatesRoot(), locale),
    path.join(process.cwd(), 'functions', 'src', 'templates', locale),
  ]

  const uniquePaths = Array.from(new Set(basePaths))

  const orderedBasenames = [
    `${template}_${variant}.mjml`,
    `${template}_${variant}.hbs`,
    `${template}.mjml`,
    `${template}.hbs`,
  ]

  for (const base of uniquePaths) {
    for (const name of orderedBasenames) {
      const filePath = path.join(base, name)
      filenames.push({
        cacheKey: `${filePath}`,
        filePath,
        extension: name.endsWith('.mjml') ? '.mjml' : '.hbs',
      })
    }
  }

  return filenames
}

async function tryLoadTemplate(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

function getTemplatesRoot(): string {
  return path.resolve(__dirname, '.')
}

function normaliseLocale(value: string): AppLocale {
  const lower = value?.toLowerCase?.() ?? ''
  if (lower === 'zh-tw' || lower === 'zh_tw' || lower === 'zh-hant' || lower.startsWith('zh')) {
    return 'zh-TW'
  }
  return 'en'
}
