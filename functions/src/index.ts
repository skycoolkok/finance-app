// functions/src/index.ts
// － 完整支援 Firebase 2nd Gen + Secret Manager + Resend 正式版（不使用 SecretParam / getSecretValue）－

import * as admin from 'firebase-admin'

// v2 imports
import {
  onRequest,
  onCall,
  type HttpsOptions,
} from 'firebase-functions/v2/https'
import {
  onSchedule,
  type ScheduleOptions,
} from 'firebase-functions/v2/scheduler'
import * as logger from 'firebase-functions/logger'
import { defineSecret } from 'firebase-functions/params'

// 你自己的模組
import { getResendClient } from './resendClient'
import { budgetEngine as runBudgetEngine } from './notif/budgetEngine'
import { sendMail } from './mailer'

// ----------------------------------------------------------------------------
// Secret / Region
// ----------------------------------------------------------------------------
const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
const REGION = 'asia-east1'

// ----------------------------------------------------------------------------
// 初始化
// ----------------------------------------------------------------------------
admin.initializeApp()
const firestore = admin.firestore()
const messaging = admin.messaging()

// ----------------------------------------------------------------------------
// 共用 options（不要用 `as const`，不然 secrets 會變 readonly 型別）
// ----------------------------------------------------------------------------
import type { CallableOptions } from 'firebase-functions/v2/https'

const callableCommon: CallableOptions = {
  region: REGION,
  invoker: 'public',
  secrets: [RESEND_API_KEY], // 可變陣列型別 (string | SecretParam)[]
}

const httpsCommon: HttpsOptions = {
  region: REGION,
  invoker: 'public',
  secrets: [RESEND_API_KEY],
}

const scheduleCommon: Partial<ScheduleOptions> = {
  region: REGION,
  secrets: [RESEND_API_KEY],
}

// ----------------------------------------------------------------------------
// registerToken（v2 onCall）
// ----------------------------------------------------------------------------
export const registerToken = onCall<{ token?: string; userId?: string }>(
  callableCommon,
  async (req) => {
    const token = typeof req.data?.token === 'string' ? req.data.token.trim() : ''
    if (!token) throw new Error('invalid-argument: token is required')

    const userId =
      req.auth?.uid ?? (typeof req.data?.userId === 'string' ? req.data.userId : '')
    if (!userId) throw new Error('failed-precondition: Authentication required')

    const platform =
      typeof (req as any)?.data?.platform === 'string'
        ? (req as any).data.platform
        : 'unknown'

    const sanitizedId = sanitizeForKey(`${userId}:${token}`)
    const tokenRef = firestore.collection('user_tokens').doc(sanitizedId)

    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(tokenRef)
      const now = admin.firestore.FieldValue.serverTimestamp()
      if (snap.exists) {
        tx.update(tokenRef, { token, userId, platform, updatedAt: now })
      } else {
        tx.set(tokenRef, { token, userId, platform, createdAt: now, updatedAt: now })
      }
    })

    return { token }
  }
)

// ----------------------------------------------------------------------------
// sendTestPush（v2 onCall）
// ----------------------------------------------------------------------------
export const sendTestPush = onCall<{ userId?: string }>(callableCommon, async (req) => {
  const userId =
    req.auth?.uid ?? (typeof req.data?.userId === 'string' ? req.data.userId : '')
  if (!userId) throw new Error('failed-precondition: Authentication required')

  const resp = await sendPushToUser(userId, {
    title: 'Finance App',
    body: 'Test push notification from Finance App.',
    data: { type: 'test-push' },
  })

  if (resp.successCount === 0)
    throw new Error('failed-precondition: No device tokens for this user')

  await logNotification({
    userId,
    type: 'test-push',
    message: 'Test push notification dispatched.',
    channel: 'push',
    eventKey: 'test-push',
  })

  return { successCount: resp.successCount, failureCount: resp.failureCount }
})

// ----------------------------------------------------------------------------
// sendTestEmail（v2 onCall）
// ----------------------------------------------------------------------------
export const sendTestEmail = onCall<{ userId?: string; email?: string }>(
  callableCommon,
  async (req) => {
    const resend = await getResendClient()
    if (!resend) return { delivered: false, reason: 'RESEND_API_KEY not configured' }

    const userId =
      req.auth?.uid ?? (typeof req.data?.userId === 'string' ? req.data.userId : '')
    if (!userId) throw new Error('failed-precondition: Authentication required')

    const userRecord = await admin.auth().getUser(userId).catch(() => null)
    const email = userRecord?.email || (typeof req.data?.email === 'string' ? req.data.email : '')
    if (!email) throw new Error('failed-precondition: No email for this user')

    await resend.emails.send({
      from: 'Finance App <notifications@finance-app.dev>',
      to: email,
      subject: 'Finance App Test Email',
      html: '<h1>Finance App</h1><p>This is a test email from your notification system.</p>',
    })

    await logNotification({
      userId,
      type: 'test-email',
      message: `Test email sent to ${email}.`,
      channel: 'email',
      eventKey: 'test-email',
    })

    return { delivered: true }
  }
)

// ----------------------------------------------------------------------------
export const scheduledBudget = onSchedule(
  {
    ...scheduleCommon,
    schedule: 'every 6 hours',
    timeZone: 'Asia/Taipei',
  } as ScheduleOptions,
  async () => {
    await runBudgetEngine({
      firestore,
      resendClient: await getResendClient(),
      sendPushToUser,
      logNotification,
      rememberNotificationKey,
      wasEventSentRecently,
      lookupUserEmail,
    })
  }
)

// ----------------------------------------------------------------------------
export const sendTestEmailGet = onRequest(httpsCommon, async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Only GET or POST allowed' })
      return
    }

    const to =
      (req.method === 'GET'
        ? (req.query.to as string | undefined)
        : (req.body?.to as string | undefined)) || 'you@example.com'

    const result = await sendMail({
      to,
      subject: 'Hello from Firebase + Resend',
      html: '<p>It works 🎉</p>',
      from: 'Finance App <onboarding@resend.dev>',
    })

    res.json({ ok: true, result })
  } catch (err: any) {
    logger.error(err)
    res.status(500).json({ ok: false, error: err?.message ?? 'Unexpected error' })
  }
})

// ----------------------------------------------------------------------------
type PushPayload = {
  title: string
  body: string
  data?: Record<string, string>
}

async function fetchUserTokens(userId: string) {
  const snap = await firestore
    .collection('user_tokens')
    .where('userId', '==', userId)
    .get()

  return snap.docs
    .map((d) => d.data().token as string | undefined)
    .filter((t): t is string => Boolean(t))
}

async function sendPushToUser(userId: string, payload: PushPayload) {
  const tokens = await fetchUserTokens(userId)
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 }

  const resp = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
  })
  return { successCount: resp.successCount, failureCount: resp.failureCount }
}

async function logNotification(args: {
  userId: string
  type: string
  message: string
  channel: 'push' | 'email'
  eventKey: string
}) {
  await firestore.collection('notifications').add({
    ...args,
    read: false,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

function notificationKeyRef(userId: string, eventKey: string, channel: 'push' | 'email') {
  const docId = sanitizeForKey(`${userId}:${channel}:${eventKey}`)
  return firestore.collection('notif_keys').doc(docId)
}

async function rememberNotificationKey(
  userId: string,
  eventKey: string,
  channel: 'push' | 'email'
) {
  const ref = notificationKeyRef(userId, eventKey, channel)
  await ref.set({
    userId,
    eventKey,
    channel,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

const NOTIF_WINDOW_MS = 24 * 60 * 60 * 1000
async function wasEventSentRecently(
  userId: string,
  eventKey: string,
  channel: 'push' | 'email'
) {
  const ref = notificationKeyRef(userId, eventKey, channel)
  const snap = await ref.get()
  if (!snap.exists) return false
  const sentAt = snap.get('sentAt') as admin.firestore.Timestamp | undefined
  if (!sentAt) return false
  return sentAt.toMillis() >= Date.now() - NOTIF_WINDOW_MS
}

async function lookupUserEmail(userId: string) {
  const rec = await admin.auth().getUser(userId).catch(() => null)
  return rec?.email ?? null
}

function sanitizeForKey(v: string) {
  return v.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export * from './testMail'
