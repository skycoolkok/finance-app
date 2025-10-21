// functions/src/testMail.ts
import { onRequest, type HttpsOptions } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { sendMail } from './mailer';

const common: HttpsOptions = { region: 'asia-east1' };

export const sendTestEmail = onRequest(common, async (req: any, res: any) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Only GET or POST allowed' });
      return;
    }

    const to =
      (req.method === 'GET'
        ? (req.query.to as string | undefined)
        : (req.body?.to as string | undefined)) || 'you@example.com';

    const result = await sendMail({
      to,
      subject: 'Hello from Firebase + Resend',
      html: '<p>It works 🎉</p>',
    });

    res.json({ ok: true, result });
  } catch (err: any) {
    logger.error(err);
    res.status(500).json({ ok: false, error: err?.message ?? 'Unexpected error' });
  }
});

