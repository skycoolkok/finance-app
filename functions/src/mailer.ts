// functions/src/mailer.ts

import { getResendClient } from './resendClient'

type MailParams = {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendMail(params: MailParams) {
  const resend = await getResendClient()
  if (!resend) throw new Error('Resend client not configured')

  const from = params.from || 'Finance App <onboarding@resend.dev>'

  const result = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  })

  return result
}
