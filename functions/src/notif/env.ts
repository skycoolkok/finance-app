import { logger } from 'firebase-functions'
import {
  APP_BASE_URL,
  getClickRedirectUrl as readClickRedirectUrl,
  getOpenPixelUrl as readOpenPixelUrl,
} from '../params'

const FALLBACK_APP_BASE_URL = 'https://finance-app-sigma-jet.vercel.app'
const FALLBACK_OPEN_PIXEL_URL = `${FALLBACK_APP_BASE_URL}/api/track/open`
const FALLBACK_CLICK_REDIRECT_URL = `${FALLBACK_APP_BASE_URL}/api/track/click`

let cachedBaseUrl: string | null = null
let cachedOpenPixelUrl: string | null = null
let cachedClickRedirectUrl: string | null = null

export function getAppBaseUrl(): string {
  if (cachedBaseUrl) {
    return cachedBaseUrl
  }

  const secretValue = readAppBaseUrlSecret()
  const envUrl = normalizeBaseUrl(secretValue ?? process.env.APP_BASE_URL)
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

export function getOpenPixelUrl(): string | undefined {
  if (cachedOpenPixelUrl !== null) {
    return cachedOpenPixelUrl || undefined
  }

  const configured = normalizeTrackingUrl(readOpenPixelUrl())

  cachedOpenPixelUrl = configured ?? ''
  if (!configured) {
    logger.debug('OPEN_PIXEL_URL not configured; skipping open pixel injection.')
  }
  return cachedOpenPixelUrl || undefined
}

export function getClickRedirectUrl(): string | undefined {
  if (cachedClickRedirectUrl !== null) {
    return cachedClickRedirectUrl || undefined
  }

  const configured = normalizeTrackingUrl(readClickRedirectUrl())

  cachedClickRedirectUrl = configured ?? ''
  if (!configured) {
    logger.debug('CLICK_REDIRECT_URL not configured; skipping click redirect tracking.')
  }
  return cachedClickRedirectUrl || undefined
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

function normalizeTrackingUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }

  try {
    const normalised = new URL(trimmed).toString()
    return normalised
  } catch {
    logger.warn('Invalid tracking URL provided; ignoring value.', { value: trimmed })
    return undefined
  }
}

function readAppBaseUrlSecret(): string | undefined {
  try {
    const value = APP_BASE_URL.value()
    if (value && value.trim()) {
      return value
    }
  } catch (error) {
    logger.debug('Unable to read APP_BASE_URL secret', { error })
  }
  return undefined
}

export { FALLBACK_APP_BASE_URL, FALLBACK_OPEN_PIXEL_URL, FALLBACK_CLICK_REDIRECT_URL }
