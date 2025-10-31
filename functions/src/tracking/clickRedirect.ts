import { logger } from 'firebase-functions'
import { onRequest } from 'firebase-functions/v2/https'

import { getAppBaseUrl, getClickRedirectUrl } from '../notif/env'

const TRACKING_OPTIONS = {
  region: 'asia-east1',
  cpu: 1,
  memory: '256MiB' as const,
  timeoutSeconds: 30,
}

export const clickRedirect = onRequest(TRACKING_OPTIONS, async (req, res) => {
  const targetUrl = resolveTargetUrl(req.query)
  const status = 302

  try {
    const { nid, variant, uid, event } = req.query ?? {}
    logger.debug('clickRedirect event', { nid, variant, uid, event, targetUrl })
  } catch (error) {
    logger.warn('Failed to log click redirect event', { error })
  }

  res.set('Cache-Control', 'no-store')
  res.set('Access-Control-Allow-Origin', '*')
  res.redirect(status, targetUrl)
})

function resolveTargetUrl(query: Record<string, unknown> | undefined): string {
  const base = getAppBaseUrl()

  if (!query) {
    return base
  }

  const raw =
    (Array.isArray(query.url) ? query.url[0] : (query.url as string | undefined)) ??
    (Array.isArray(query.target) ? query.target[0] : (query.target as string | undefined)) ??
    null

  if (!raw) {
    return base
  }

  const decoded = decodeTarget(raw)
  if (!decoded) {
    return base
  }

  try {
    const url = new URL(decoded)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  } catch {
    // ignore invalid
  }

  return base
}

function decodeTarget(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    return decodeURIComponent(trimmed)
  } catch {
    // ignore
  }

  try {
    const buffer = Buffer.from(trimmed, 'base64')
    return buffer.toString('utf8')
  } catch {
    return trimmed
  }
}

export function resolveClickRedirectUrl(): string | undefined {
  return getClickRedirectUrl()
}
