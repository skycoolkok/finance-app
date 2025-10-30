import { logger } from 'firebase-functions'
import { onRequest } from 'firebase-functions/v2/https'

import { getAppBaseUrl } from './notif/env'
import { APP_BASE_URL, RESEND_API_KEY } from './params'
import { memo } from './lib/lazy'

const getMailer = memo(() => require('./mailer') as typeof import('./mailer'))
const getResendClientModule = memo(() => require('./resendClient') as typeof import('./resendClient'))

const REGION = 'asia-east1'

const HTTPS_OPTIONS = {
  region: REGION,
  cpu: 1,
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  secrets: [RESEND_API_KEY, APP_BASE_URL],
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
  const mailer = getMailer()
  const resendClientModule = getResendClientModule()

  try {
    await mailer.sendMail({
      to: recipient,
      subject: mailer.TEST_EMAIL_SUBJECT,
      html: mailer.buildTestEmailHtml(baseUrl),
      text: mailer.buildTestEmailText(baseUrl),
    })
  } catch (error) {
    if (error instanceof resendClientModule.MissingResendApiKeyError) {
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
    subject: mailer.TEST_EMAIL_SUBJECT,
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
