import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import { defineSecret } from 'firebase-functions/params'
import {
  onCall,
  onRequest,
  type CallableOptions,
  type HttpsOptions,
} from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'

import { getResendClient } from './resendClient'
import { budgetEngine as runBudgetEngine } from './notif/budgetEngine'
import { sendMail } from './mailer'

const REGION = 'asia-east1'
const RESEND_API_KEY = defineSecret('RESEND_API_KEY')

admin.initializeApp()
const firestore = admin.firestore()
const messaging = admin.messaging()

type RegisterTokenRequest = {
  token?: string
  userId?: string
  platform?: string
}

type SendTestPushRequest = {
  userId?: string
}

type SendTestEmailRequest = {
  userId?: string
  email?: string
}

const callableOptions: CallableOptions = {
  region: REGION,
  invoker: 'public',
  secrets: [RESEND_API_KEY],
}

const httpsOptions: HttpsOptions = {
  region: REGION,
  invoker: 'public',
  secrets: [RESEND_API_KEY],
}

export const registerToken = onCall<RegisterTokenRequest>(callableOptions, async request => {
  const token = request.data.token?.trim() ?? ''
  if (!token) {
    throw new Error('invalid-argument: token is required')
  }

  const userId = request.auth?.uid ?? request.data.userId ?? ''
  if (!userId) {
    throw new Error('failed-precondition: Authentication required')
  }

  const platform = request.data.platform?.trim() ?? 'unknown'
  const sanitizedId = sanitizeForKey(`${userId}:${token}`)
  const tokenRef = firestore.collection('user_tokens').doc(sanitizedId)

  await firestore.runTransaction(async tx => {
    const snapshot = await tx.get(tokenRef)
    const timestamp = admin.firestore.FieldValue.serverTimestamp()
    if (snapshot.exists) {
      tx.update(tokenRef, { token, userId, platform, updatedAt: timestamp })
    } else {
      tx.set(tokenRef, {
        token,
        userId,
        platform,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
  })

  return { token }
})

export const sendTestPush = onCall<SendTestPushRequest>(callableOptions, async request => {
  const userId = request.auth?.uid ?? request.data.userId ?? ''
  if (!userId) {
    throw new Error('failed-precondition: Authentication required')
  }

  const response = await sendPushToUser(userId, {
    title: 'Finance App',
    body: 'Test push notification from Finance App.',
    data: { type: 'test-push' },
  })

  if (response.successCount === 0) {
    throw new Error('failed-precondition: No device tokens for this user')
  }

  await logNotification({
    userId,
    type: 'test-push',
    message: 'Test push notification dispatched.',
    channel: 'push',
    eventKey: 'test-push',
  })

  return { successCount: response.successCount, failureCount: response.failureCount }
})

export const sendTestEmail = onCall<SendTestEmailRequest>(callableOptions, async request => {
  const resend = await getResendClient()

  const userId = request.auth?.uid ?? request.data.userId ?? ''
  if (!userId) {
    throw new Error('failed-precondition: Authentication required')
  }

  const userRecord = await admin
    .auth()
    .getUser(userId)
    .catch(() => null)
  const to = request.data.email ?? userRecord?.email ?? ''

  if (!to) {
    throw new Error('failed-precondition: No email available for this user')
  }

  await resend.emails.send({
    from: 'Finance App <notifications@finance-app.dev>',
    to,
    subject: 'Finance App Test Email',
    html: '<h1>Finance App</h1><p>This is a test email from your notification system.</p>',
  })

  await logNotification({
    userId,
    type: 'test-email',
    message: `Test email sent to ${to}.`,
    channel: 'email',
    eventKey: 'test-email',
  })

  return { delivered: true }
})

export const scheduledReminders = functions
  .region(REGION)
  .pubsub.schedule('every 6 hours')
  .onRun(async () => {
    const cardsSnapshot = await firestore.collection('cards').get()
    if (cardsSnapshot.empty) {
      logger.info('No cards found for reminder processing.')
      return null
    }

    const now = new Date()
    const dueThresholds = new Set([7, 3, 1, 0])

    for (const cardDoc of cardsSnapshot.docs) {
      const card = cardDoc.data() as FirestoreCard
      const cardId = cardDoc.id
      const userId = card.userId ?? ''

      if (!userId || !card.statementDay || !card.dueDay || !(card.limitAmount > 0)) {
        continue
      }

      const cycle = computeCycle(now, card.statementDay)
      const dueDate = computeDueDate(cycle.end, card.dueDay)
      const daysToDue = calculateDaysLeft(now, dueDate)

      const currentDue = await sumTransactions({
        userId,
        cardId,
        start: cycle.start,
        end: cycle.end,
      })

      const utilization = card.limitAmount > 0 ? currentDue / card.limitAmount : 0
      const cardLabel = card.alias || card.issuer || `Card ${card.last4 ?? ''}`

      const reminders: ReminderEvent[] = []

      if (dueThresholds.has(daysToDue) || daysToDue < 0) {
        const message = formatDueMessage(cardLabel, daysToDue, dueDate, currentDue)
        reminders.push({
          userId,
          cardId,
          cardLabel,
          eventKey: `card:${cardId}:due:${daysToDue}`,
          type: 'due-reminder',
          message,
          pushTitle: 'Card payment reminder',
          emailSubject: 'Card payment reminder',
        })
      }

      if (utilization >= 0.95) {
        const message = `${cardLabel} has reached ${Math.round(utilization * 100)}% of its credit limit.`
        reminders.push({
          userId,
          cardId,
          cardLabel,
          eventKey: `card:${cardId}:utilization:95`,
          type: 'utilization-95',
          message,
          pushTitle: 'High utilization alert',
          emailSubject: 'High utilization alert',
        })
      } else if (utilization >= 0.8) {
        const message = `${cardLabel} has used ${Math.round(utilization * 100)}% of its credit limit.`
        reminders.push({
          userId,
          cardId,
          cardLabel,
          eventKey: `card::utilization:80`,
          type: 'utilization-80',
          message,
          pushTitle: 'Utilization warning',
          emailSubject: 'Utilization warning',
        })
      }

      for (const reminder of reminders) {
        await deliverReminder(reminder)
      }
    }

    return null
  })

export const scheduledBudget = functions
  .region(REGION)
  .pubsub.schedule('every 6 hours')
  .timeZone('Asia/Taipei')
  .onRun(async () =>
    runBudgetEngine({
      firestore,
      resendClient: await getResendClient(),
      sendPushToUser,
      logNotification,
      rememberNotificationKey,
      wasEventSentRecently,
      lookupUserEmail,
    }),
  )

export const sendTestEmailGet = onRequest(httpsOptions, async (req, res) => {
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
      html: '<p>It works OK ✅</p>',
      from: 'Finance App <onboarding@resend.dev>',
    })

    res.json({ ok: true, result })
  } catch (error: unknown) {
    logger.error(error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    res.status(500).json({ ok: false, error: message })
  }
})

type PushPayload = {
  title: string
  body: string
  data?: Record<string, string>
}

type FirestoreCard = {
  alias?: string
  issuer: string
  last4?: string
  statementDay: number
  dueDay: number
  limitAmount: number
  userId?: string
}

type ReminderEvent = {
  userId: string
  cardId: string
  cardLabel: string
  eventKey: string
  type: string
  message: string
  pushTitle: string
  emailSubject: string
}

async function deliverReminder(reminder: ReminderEvent) {
  const { userId, eventKey, message, pushTitle, emailSubject, type } = reminder

  const pushSentRecently = await wasEventSentRecently(userId, eventKey, 'push')
  if (!pushSentRecently) {
    const result = await sendPushToUser(userId, {
      title: pushTitle,
      body: message,
      data: { type, cardId: reminder.cardId, eventKey },
    })

    if (result.successCount + result.failureCount > 0) {
      await logNotification({ userId, type, message, channel: 'push', eventKey })
      await rememberNotificationKey(userId, eventKey, 'push')
    }
  }

  const emailSentRecently = await wasEventSentRecently(userId, eventKey, 'email')
  if (!emailSentRecently) {
    const email = await lookupUserEmail(userId)
    if (email) {
      const resend = await getResendClient()
      await resend.emails.send({
        from: 'Finance App <notifications@finance-app.dev>',
        to: email,
        subject: emailSubject,
        html: `<h2>${emailSubject}</h2><p>${message}</p>`,
      })

      await logNotification({ userId, type, message, channel: 'email', eventKey })
      await rememberNotificationKey(userId, eventKey, 'email')
    }
  }
}

async function fetchUserTokens(userId: string) {
  const snapshot = await firestore.collection('user_tokens').where('userId', '==', userId).get()

  return snapshot.docs
    .map(doc => doc.data().token as string | undefined)
    .filter((token): token is string => Boolean(token))
}

async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  _options?: { cache?: Map<string, string[]> },
) {
  const tokens = await fetchUserTokens(userId)
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 }
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
  })

  return { successCount: response.successCount, failureCount: response.failureCount }
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
  channel: 'push' | 'email',
) {
  const ref = notificationKeyRef(userId, eventKey, channel)
  await ref.set({
    userId,
    eventKey,
    channel,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000
async function wasEventSentRecently(userId: string, eventKey: string, channel: 'push' | 'email') {
  const ref = notificationKeyRef(userId, eventKey, channel)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    return false
  }

  const sentAt = snapshot.get('sentAt') as admin.firestore.Timestamp | undefined
  if (!sentAt) {
    return false
  }

  return sentAt.toMillis() >= Date.now() - NOTIFICATION_WINDOW_MS
}

async function lookupUserEmail(userId: string) {
  const record = await admin
    .auth()
    .getUser(userId)
    .catch(() => null)
  return record?.email ?? null
}

type SumTransactionParams = {
  userId: string
  cardId: string
  start: Date
  end: Date
}

async function sumTransactions({ userId, cardId, start, end }: SumTransactionParams) {
  const startISO = toISODate(start)
  const endISO = toISODate(end)

  const snapshot = await firestore
    .collection('transactions')
    .where('userId', '==', userId)
    .where('cardId', '==', cardId)
    .where('affectCurrentBill', '==', true)
    .where('date', '>=', startISO)
    .where('date', '<=', endISO)
    .get()

  return snapshot.docs.reduce((total, doc) => {
    const amount = doc.data().amount as number | undefined
    return total + (typeof amount === 'number' ? amount : 0)
  }, 0)
}

function computeCycle(todayInput: Date, statementDay: number) {
  const today = normalizeDate(todayInput)
  const currentMonthStatement = new Date(today.getFullYear(), today.getMonth(), statementDay)
  const cycleEnd =
    today.getDate() <= statementDay
      ? currentMonthStatement
      : new Date(today.getFullYear(), today.getMonth() + 1, statementDay)

  const previousCycleEnd = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() - 1, statementDay)
  const cycleStart = new Date(previousCycleEnd)
  cycleStart.setDate(previousCycleEnd.getDate() + 1)

  return { start: cycleStart, end: cycleEnd }
}

function computeDueDate(cycleEndInput: Date, dueDay: number) {
  const cycleEnd = normalizeDate(cycleEndInput)
  let dueDate = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), dueDay)
  if (dueDate <= cycleEnd) {
    dueDate = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, dueDay)
  }
  return dueDate
}

function calculateDaysLeft(from: Date, to: Date) {
  const diffMs = normalizeDate(to).getTime() - normalizeDate(from).getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function normalizeDate(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function toISODate(date: Date) {
  return normalizeDate(date).toISOString().split('T')[0]
}

function formatDueMessage(cardLabel: string, daysToDue: number, dueDate: Date, currentDue: number) {
  const dueDisplay = dueDate.toDateString()
  const amountDisplay = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(currentDue)

  if (daysToDue < 0) {
    return `${cardLabel} payment was due on ${dueDisplay}. Outstanding balance: ${amountDisplay}.`
  }
  if (daysToDue === 0) {
    return `${cardLabel} payment is due today (${dueDisplay}). Balance: ${amountDisplay}.`
  }
  if (daysToDue === 1) {
    return `${cardLabel} payment is due tomorrow (${dueDisplay}). Balance: ${amountDisplay}.`
  }
  return `${cardLabel} payment is due in ${daysToDue} days on ${dueDisplay}. Balance: ${amountDisplay}.`
}

function sanitizeForKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export * from './testMail'
