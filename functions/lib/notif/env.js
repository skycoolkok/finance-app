'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.FALLBACK_CLICK_REDIRECT_URL =
  exports.FALLBACK_OPEN_PIXEL_URL =
  exports.FALLBACK_APP_BASE_URL =
    void 0
exports.getAppBaseUrl = getAppBaseUrl
exports.getOpenPixelUrl = getOpenPixelUrl
exports.getClickRedirectUrl = getClickRedirectUrl
const firebase_functions_1 = require('firebase-functions')
const params_1 = require('../params')
const DEFAULT_BASE_URL = 'https://finance-app.local'
exports.FALLBACK_APP_BASE_URL = DEFAULT_BASE_URL
const FALLBACK_OPEN_PIXEL_URL = `${DEFAULT_BASE_URL}/api/track/open`
exports.FALLBACK_OPEN_PIXEL_URL = FALLBACK_OPEN_PIXEL_URL
const FALLBACK_CLICK_REDIRECT_URL = `${DEFAULT_BASE_URL}/api/track/click`
exports.FALLBACK_CLICK_REDIRECT_URL = FALLBACK_CLICK_REDIRECT_URL
let cachedBaseUrl = null
let cachedOpenPixelUrl = null
let cachedClickRedirectUrl = null
function getAppBaseUrl() {
  if (cachedBaseUrl) {
    return cachedBaseUrl
  }
  const baseCandidate = (0, params_1.getBaseUrl)()
  const normalized = normalizeBaseUrl(baseCandidate)
  if (normalized) {
    cachedBaseUrl = normalized
    if (baseCandidate === DEFAULT_BASE_URL) {
      firebase_functions_1.logger.warn('APP_BASE_URL not configured; using fallback URL.', {
        fallback: normalized,
      })
    }
    return cachedBaseUrl
  }
  cachedBaseUrl = DEFAULT_BASE_URL
  firebase_functions_1.logger.warn('APP_BASE_URL not configured; using fallback URL.', {
    fallback: DEFAULT_BASE_URL,
  })
  return cachedBaseUrl
}
function getOpenPixelUrl() {
  if (cachedOpenPixelUrl !== null) {
    return cachedOpenPixelUrl || undefined
  }
  const configured = normalizeTrackingUrl((0, params_1.getOpenPixelUrl)())
  cachedOpenPixelUrl = configured ?? ''
  if (!configured) {
    firebase_functions_1.logger.debug(
      'OPEN_PIXEL_URL not configured; skipping open pixel injection.',
    )
  }
  return cachedOpenPixelUrl || undefined
}
function getClickRedirectUrl() {
  if (cachedClickRedirectUrl !== null) {
    return cachedClickRedirectUrl || undefined
  }
  const configured = normalizeTrackingUrl((0, params_1.getClickRedirectUrl)())
  cachedClickRedirectUrl = configured ?? ''
  if (!configured) {
    firebase_functions_1.logger.debug(
      'CLICK_REDIRECT_URL not configured; skipping click redirect tracking.',
    )
  }
  return cachedClickRedirectUrl || undefined
}
function normalizeBaseUrl(value) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  try {
    const normalized = new URL(trimmed).toString()
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
  } catch {
    firebase_functions_1.logger.warn('Invalid APP_BASE_URL provided; ignoring value.', {
      value: trimmed,
    })
    return null
  }
}
function normalizeTrackingUrl(value) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }
  try {
    const normalised = new URL(trimmed).toString()
    return normalised
  } catch {
    firebase_functions_1.logger.warn('Invalid tracking URL provided; ignoring value.', {
      value: trimmed,
    })
    return undefined
  }
}
