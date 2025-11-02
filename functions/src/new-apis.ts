import * as admin from 'firebase-admin'
import { onCall } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2/options'
import { logger } from 'firebase-functions'
import { Resend } from 'resend'

import { memo } from './lib/lazy'
import { RESEND_API_KEY } from './params'

const REGION = 'asia-east1'
setGlobalOptions({
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
})

if (!admin.apps.length) {
  admin.initializeApp()
}

const getFirestore = memo(() => admin.firestore())
const getMessaging = memo(() => admin.messaging())
const getResend = memo(() => {
  const key = RESEND_API_KEY.value()
  if (!key) {
    logger.warn('RESEND_API_KEY not set. Email notifications will be skipped.')
    throw new Error('RESEND_API_KEY not configured')
  }
  return new Resend(key)
})

const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000

export const ping = onCall({ region: REGION, secrets: [RESEND_API_KEY] }, async (request) => {
  let resendReady = true
  try {
    getResend()
  } catch {
    resendReady = false
  }

  return {
    ok: true,
    echo: request.data ?? null,
    env: {
      emulator: process.env.FUNCTIONS_EMULATOR === 'true',
      projectId: process.env.GCLOUD_PROJECT,
      region: REGION,
      resendReady,
    },
  }
})

export const sendTestPush = onCall<{ userId?: string } | null>(
  { region: REGION, secrets: [RESEND_API_KEY] },
  async ({ data }) => {
    const userId = (data?.userId ?? '').toString().trim()
    if (!userId) {
      throw new Error('missing userId')
    }

    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      return { mocked: true, sent: true, userId, note: 'Emulator mock response' }
    }

    await getMessaging().send({
      topic: `user_${userId}`,
      notification: { title: 'Hello', body: 'This is a test push' },
    })

    return { mocked: false, sent: true, userId }
  },
)

type RegisterTokenData = { token: string; userId?: string }

export const registerToken = onCall<RegisterTokenData | null>(
  { region: REGION, secrets: [RESEND_API_KEY] },
  async (request) => {
    const token = (request.data?.token ?? '').toString().trim()
    const userId = (request.data?.userId ?? request.auth?.uid ?? '').toString().trim() || null

    if (!token) {
      throw new Error('missing token')
    }

    await getFirestore().collection('pushTokens').doc(token).set(
      {
        uid: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        windowMs: NOTIFICATION_WINDOW_MS,
      },
      { merge: true },
    )

    try {
      getResend()
    } catch (error) {
      logger.debug('Resend client unavailable during registerToken invocation', { error })
    }

    return { ok: true, token, userId }
  },
)
