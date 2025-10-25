import { config as functionsConfig, logger } from 'firebase-functions'

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

  const configUrl = normalizeBaseUrl(
    readAppConfigValue('APP_BASE_URL') ?? readAppConfigValue('BASE_URL'),
  )
  if (configUrl) {
    cachedBaseUrl = configUrl
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

export function getOpenPixelUrl(): string | undefined {
  if (cachedOpenPixelUrl !== null) {
    return cachedOpenPixelUrl || undefined
  }

  const configured =
    normalizeTrackingUrl(readAppConfigValue('OPEN_PIXEL_URL')) ||
    normalizeTrackingUrl(process.env.OPEN_PIXEL_URL)

  cachedOpenPixelUrl = configured ?? ''
  if (!configured) {
    logger.info('OPEN_PIXEL_URL not configured; using default fallback.')
  }
  return cachedOpenPixelUrl || undefined
}

export function getClickRedirectUrl(): string | undefined {
  if (cachedClickRedirectUrl !== null) {
    return cachedClickRedirectUrl || undefined
  }

  const configured =
    normalizeTrackingUrl(readAppConfigValue('CLICK_REDIRECT_URL')) ||
    normalizeTrackingUrl(process.env.CLICK_REDIRECT_URL)

  cachedClickRedirectUrl = configured ?? ''
  if (!configured) {
    logger.info('CLICK_REDIRECT_URL not configured; using default fallback.')
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

function readAppConfigValue(key: string): string | undefined {
  try {
    const config = functionsConfig()
    const appConfig = config?.app
    if (!appConfig) {
      return undefined
    }

    const direct = appConfig[key]
    if (typeof direct === 'string' && direct.trim().length > 0) {
      return direct
    }

    const normalisedKey = key.toLowerCase()
    const lowerValue = appConfig[normalisedKey]
    if (typeof lowerValue === 'string' && lowerValue.trim().length > 0) {
      return lowerValue
    }

    const snakeKey = key.replace(/([A-Z])/g, (_, letter: string) => `_${letter.toLowerCase()}`)
    const snakeValue = appConfig[snakeKey]
    if (typeof snakeValue === 'string' && snakeValue.trim().length > 0) {
      return snakeValue
    }
  } catch (error) {
    logger.debug('Unable to read Firebase Functions config', { error })
  }
  return undefined
}

export { FALLBACK_APP_BASE_URL, FALLBACK_OPEN_PIXEL_URL, FALLBACK_CLICK_REDIRECT_URL }
