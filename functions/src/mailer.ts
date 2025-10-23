import { logger } from 'firebase-functions'
import type { Resend } from 'resend'

import { getResendClient } from './resendClient'

const DEFAULT_FROM = 'Finance App <notifications@finance-app.dev>'
export const TEST_EMAIL_SUBJECT = 'Finance App Test Email'

export function buildTestEmailHtml(baseUrl: string): string {
  return [
    '<h1>Finance App</h1>',
    '<p>This is a test email from your notification system.</p>',
    `<p><a href="${baseUrl}">Open Finance App</a></p>`,
  ].join('')
}

export function buildTestEmailText(baseUrl: string): string {
  return `Finance App test email. Visit ${baseUrl}`
}

export type SendMailOptions = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

type SendMailResponse = Awaited<ReturnType<Resend['emails']['send']>>

export async function sendMail(options: SendMailOptions): Promise<SendMailResponse> {
  const resend = await getResendClient()
  const payload = {
    from: options.from ?? DEFAULT_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    reply_to: options.replyTo,
  }

  const response = await resend.emails.send(payload)
  logger.debug('Email dispatched via Resend.', {
    to: payload.to,
    subject: payload.subject,
  })
  return response
}
