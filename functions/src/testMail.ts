import { onRequest, type HttpsOptions } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import type { Request, Response } from 'express'

import { sendMail } from './mailer'

const common: HttpsOptions = { region: 'asia-east1' }

export const sendTestEmail = onRequest(common, async (req: Request, res: Response) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Only GET or POST allowed' })
      return
    }

    const to =
      (req.method === 'GET'
        ? (req.query.to as string | undefined)
        : (req.body?.to as string | undefined)) ?? 'you@example.com'

    const result = await sendMail({
      to,
      subject: 'Hello from Firebase + Resend',
      html: '<p>It works OK</p>',
    })

    res.json({ ok: true, result })
  } catch (error: unknown) {
    logger.error(error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    res.status(500).json({ ok: false, error: message })
  }
})
