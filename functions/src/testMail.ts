import { logger } from 'firebase-functions'
import { onRequest } from 'firebase-functions/v2/https'

import {
  TEST_EMAIL_SUBJECT,
  buildTestEmailHtml,
  buildTestEmailText,
  sendMail,
} from './mailer'
import { getAppBaseUrl } from './notif/env'
import { MissingResendApiKeyError, RESEND_API_KEY } from './resendClient'

const REGION = 'asia-east1'

const HTTPS_OPTIONS = {
  region: REGION,
  cpu: 1,
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  secrets: [RESEND_API_KEY],
}

export const sendTestEmailGet = onRequest(HTTPS_OPTIONS, async (req, res) => {
  if (req.method !== 'GET') {
    res.set('Allow', 'GET')
    res.status(405).send('Method Not Allowed')
    return
  }

  const recipient = normalizeQueryValue(req.query.to)
  if (!recipient) {
    res.status(400).json({ error: 'Missing "to" query parameter.' })
    return
  }

  const baseUrl = getAppBaseUrl()

  try {
    await sendMail({
      to: recipient,
      subject: TEST_EMAIL_SUBJECT,
      html: buildTestEmailHtml(baseUrl),
      text: buildTestEmailText(baseUrl),
    })
  } catch (error) {
    if (error instanceof MissingResendApiKeyError) {
      res.status(500).json({ error: 'RESEND_API_KEY is not configured.' })
      return
    }

    logger.error('Failed to dispatch test email via HTTP endpoint.', normalizeError(error), {
      recipient,
    })
    res.status(500).json({ error: 'Failed to send test email.' })
    return
  }

  res.status(200).json({
    delivered: true,
    to: recipient,
    subject: TEST_EMAIL_SUBJECT,
  })
})

function normalizeQueryValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value) && value.length > 0) {
    return normalizeQueryValue(value[0])
  }

  return ''
}

function normalizeError(error: unknown): { message: string } {
  if (error instanceof Error) {
    return { message: error.message }
  }
  return { message: 'Unknown error' }
}
