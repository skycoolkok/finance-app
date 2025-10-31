import { logger } from 'firebase-functions'
import { onRequest } from 'firebase-functions/v2/https'

import { getOpenPixelUrl } from '../notif/env'

const GIF_BASE64 = 'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='
const GIF_BUFFER = Buffer.from(GIF_BASE64, 'base64')

const TRACKING_OPTIONS = {
  region: 'asia-east1',
  cpu: 1,
  memory: '256MiB' as const,
  timeoutSeconds: 30,
}

export const openPixel = onRequest(TRACKING_OPTIONS, async (req, res) => {
  try {
    const { nid, variant, uid, event } = req.query ?? {}
    logger.debug('openPixel beacon received', {
      nid,
      variant,
      uid,
      event,
      source: req.headers['user-agent'],
    })
  } catch (error) {
    logger.warn('Failed to log open pixel event', { error })
  }

  res.set('Content-Type', 'image/gif')
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  res.set('Content-Length', GIF_BUFFER.length.toString())
  res.set('Access-Control-Allow-Origin', '*')
  res.status(200).send(GIF_BUFFER)
})

export function resolveOpenPixelUrl(): string | undefined {
  return getOpenPixelUrl()
}
