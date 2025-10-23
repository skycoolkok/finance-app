import { logger } from 'firebase-functions'

const FALLBACK_APP_BASE_URL = 'https://finance-app-sigma-jet.vercel.app'

let cachedBaseUrl: string | null = null

export function getAppBaseUrl(): string {
  if (cachedBaseUrl) {
    return cachedBaseUrl
  }

  const envUrl = normalizeBaseUrl(process.env.APP_BASE_URL)
  if (envUrl) {
    cachedBaseUrl = envUrl
    return cachedBaseUrl
  }

  cachedBaseUrl = FALLBACK_APP_BASE_URL
  logger.warn('APP_BASE_URL not configured; using fallback URL.', {
    fallback: FALLBACK_APP_BASE_URL,
  })
  return cachedBaseUrl
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  try {
    const normalized = new URL(trimmed).toString()
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
  } catch {
    logger.warn('Invalid APP_BASE_URL provided; ignoring value.', { value: trimmed })
    return null
  }
}

export { FALLBACK_APP_BASE_URL }
