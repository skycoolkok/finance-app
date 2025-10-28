import 'dotenv/config'

import * as admin from 'firebase-admin'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'

import {
  NotificationEngine,
  fetchUserLocale,
  logNotificationRecord,
  type ReminderEvent,
} from './notif/engine'
import { getAppBaseUrl } from './notif/env'
import { sendBudgetAlert } from './notif/budgetEngine'
import { sanitizeForKey } from './notif/utils'
import { TEST_EMAIL_SUBJECT, buildTestEmailHtml, buildTestEmailText, sendMail } from './mailer'
import { RESEND_API_KEY, MissingResendApiKeyError, getResendClientOrNull } from './resendClient'
import { resolveLocaleTag } from './templates'
import { sendTestEmailGet } from './testMail'
import { isFxAdmin as isFxAdminEmail } from './lib/admin'

const REGION = 'asia-east1'
const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000

const HTTPS_OPTIONS = {
  region: REGION,
  cpu: 1,
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  secrets: [RESEND_API_KEY],
}

const SCHEDULE_OPTIONS = {
  region: REGION,
  schedule: 'every 6 hours',
  timeZone: 'Asia/Taipei',
  cpu: 1,
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  secrets: [RESEND_API_KEY],
}

const FX_SCHEDULE_OPTIONS = {
  region: REGION,
  schedule: 'every day 04:00',
  timeZone: 'Asia/Taipei',
  cpu: 1,
  memory: '128MiB' as const,
  timeoutSeconds: 60,
}

if (!admin.apps.length) {
  admin.initializeApp()
}

const firestore = admin.firestore()
const messaging = admin.messaging()
const APP_BASE_URL = getAppBaseUrl()

type FxCurrencyCode = 'TWD' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'KRW'

const SUPPORTED_FX_CODES = new Set<FxCurrencyCode>(['TWD', 'USD', 'EUR', 'GBP', 'JPY', 'KRW'])

function isFxCurrency(value: string): value is FxCurrencyCode {
  return SUPPORTED_FX_CODES.has(value as FxCurrencyCode)
}

function normaliseFxRates(input: unknown): Record<string, number> {
  const rates: Record<string, number> = {}

  if (input && typeof input === 'object') {
    for (const [code, value] of Object.entries(input as Record<string, unknown>)) {
      const upper = code.toUpperCase()
      if (!isFxCurrency(upper)) {
        continue
      }
      const numeric = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(numeric) || numeric <= 0) {
        continue
      }
      rates[upper] = numeric
    }
  }

  rates.TWD = 1
  return rates
}

export const registerToken = onCall<{ token?: string; userId?: string; platform?: string } | null>(
  HTTPS_OPTIONS,
  async (request) => {
    const token = typeof request.data?.token === 'string' ? request.data.token.trim() : ''
    if (!token) {
      throw new HttpsError('invalid-argument', 'token is required')
    }

    const userId =
      request.auth?.uid ?? (typeof request.data?.userId === 'string' ? request.data.userId : '')
    if (!userId) {
      throw new HttpsError('failed-precondition', 'Authentication is required to register a token')
    }

    const platform = typeof request.data?.platform === 'string' ? request.data.platform : 'unknown'
    const sanitizedId = sanitizeForKey(`${userId}:${token}`)
    const tokenRef = firestore.collection('user_tokens').doc(sanitizedId)

    await firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(tokenRef)
      const timestamp = admin.firestore.FieldValue.serverTimestamp()

      if (snapshot.exists) {
        tx.update(tokenRef, {
          token,
          userId,
          platform,
          updatedAt: timestamp,
        })
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
  },
)

export const sendTestPush = onCall<{ userId?: string } | null>(HTTPS_OPTIONS, async (request) => {
  const userId =
    request.auth?.uid ?? (typeof request.data?.userId === 'string' ? request.data.userId : '')
  if (!userId) {
    throw new HttpsError(
      'failed-precondition',
      'Authentication is required to send a test push notification',
    )
  }

  const tokens = await fetchUserTokens(userId)
  if (tokens.length === 0) {
    throw new HttpsError('failed-precondition', 'No device tokens registered for this user')
  }

  const locale = await fetchUserLocale({ firestore, userId })
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: 'Finance App',
      body: 'Test push notification from Finance App.',
    },
    data: {
      type: 'test-push',
      url: APP_BASE_URL,
      locale,
    },
  })

  await logNotificationRecord(firestore, {
    userId,
    type: 'test-push',
    message: 'Test push notification dispatched.',
    channel: 'push',
    eventKey: 'test-push',
    locale,
  })

  return { successCount: response.successCount, failureCount: response.failureCount }
})

export const setFxRates = onCall<{
  date?: string
  rates?: Record<string, unknown>
  source?: 'manual' | 'api'
} | null>(HTTPS_OPTIONS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('failed-precondition', 'Authentication is required to update FX rates')
  }

  const emailValue = request.auth?.token?.email
  const email = typeof emailValue === 'string' ? emailValue.trim() : ''
  if (!isFxAdminEmail(email)) {
    throw new HttpsError('permission-denied', 'not admin')
  }

  const payload = request.data ?? {}
  const rawRates = payload.rates
  if (!rawRates || typeof rawRates !== 'object') {
    throw new HttpsError('invalid-argument', 'rates object is required')
  }

  const dateISO =
    typeof payload.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? payload.date
      : new Date().toISOString().slice(0, 10)

  const normalisedRates = normaliseFxRates(rawRates)
  const filteredRates = Object.fromEntries(
    Object.entries(normalisedRates).filter(([code]) => code !== 'TWD'),
  )

  if (Object.keys(filteredRates).length === 0) {
    throw new HttpsError('invalid-argument', 'At least one non-TWD rate must be provided')
  }

  const source: 'manual' | 'api' = payload.source === 'api' ? 'api' : 'manual'
  const docRef = firestore.collection('fx_rates').doc(dateISO)

  await docRef.set(
    {
      base: 'TWD',
      rates: filteredRates,
      source,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  logger.info('FX rates updated', { dateISO, count: Object.keys(filteredRates).length, source })

  return { date: dateISO, count: Object.keys(filteredRates).length, source }
})

export const isFxAdmin = onCall<{ email?: string } | null>(HTTPS_OPTIONS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('failed-precondition', 'Authentication is required to check admin status')
  }

  const authEmail = request.auth?.token?.email
  const emailValue =
    typeof authEmail === 'string'
      ? authEmail
      : typeof request.data?.email === 'string'
        ? request.data.email
        : ''

  const email = emailValue.trim()
  const allowed = isFxAdminEmail(email)

  return { allowed }
})

export const sendTestEmail = onCall<{ userId?: string; email?: string } | null>(
  HTTPS_OPTIONS,
  async (request) => {
    const userId =
      request.auth?.uid ?? (typeof request.data?.userId === 'string' ? request.data.userId : '')
    if (!userId) {
      throw new HttpsError('failed-precondition', 'Authentication is required to send a test email')
    }

    const userRecord = await admin
      .auth()
      .getUser(userId)
      .catch(() => null)
    const email =
      userRecord?.email ??
      (typeof request.data?.email === 'string' ? request.data.email.trim() : '')

    if (!email) {
      throw new HttpsError('failed-precondition', 'No email address available for this user')
    }

    const locale = await fetchUserLocale({ firestore, userId })

    try {
      await sendMail({
        to: email,
        subject: TEST_EMAIL_SUBJECT,
        html: buildTestEmailHtml(APP_BASE_URL),
        text: buildTestEmailText(APP_BASE_URL),
      })
    } catch (error) {
      if (error instanceof MissingResendApiKeyError) {
        throw new HttpsError('failed-precondition', 'RESEND_API_KEY is not configured')
      }

      logger.error('Failed to send test email.', normalizeError(error), {
        userId,
        email,
      })
      throw new HttpsError('internal', 'Unable to send test email')
    }

    await logNotificationRecord(firestore, {
      userId,
      type: 'test-email',
      message: 'Test email notification dispatched.',
      channel: 'email',
      eventKey: 'test-email',
      locale,
    })

    return { delivered: true }
  },
)

export const setUserLocale = onCall<{ locale?: string } | null>(HTTPS_OPTIONS, async (request) => {
  const userId = request.auth?.uid
  if (!userId) {
    throw new HttpsError('failed-precondition', 'Authentication is required to update locale')
  }

  const localeInput = typeof request.data?.locale === 'string' ? request.data.locale.trim() : ''
  if (!localeInput) {
    throw new HttpsError('invalid-argument', 'locale is required')
  }

  const normalized = resolveLocaleTag(localeInput)
  await firestore.collection('users').doc(userId).set(
    {
      locale: normalized,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return { locale: normalized }
})

export const refreshFxRates = onSchedule(FX_SCHEDULE_OPTIONS, async () => {
  logger.info('refreshFxRates stub executed - configure an external provider to enable updates.')
})

export const scheduledBudget = onSchedule(SCHEDULE_OPTIONS, async () => {
  const resendClient = await getResendClientOrNull()
  if (!resendClient) {
    logger.warn('RESEND_API_KEY is not configured. Email notifications will be skipped.')
  }

  const notificationEngine = new NotificationEngine({
    firestore,
    messaging,
    resendClient,
    notificationWindowMs: NOTIFICATION_WINDOW_MS,
    baseUrl: APP_BASE_URL,
    logger,
  })

  await processCardReminders(notificationEngine)
  await processBudgetAlerts(notificationEngine)
})

export { sendTestEmailGet }

export * from './new-apis'
export { openPixel } from './tracking/openPixel'
export { clickRedirect } from './tracking/clickRedirect'

async function fetchUserTokens(userId: string) {
  const snapshot = await firestore.collection('user_tokens').where('userId', '==', userId).get()
  return snapshot.docs
    .map((docSnapshot) => docSnapshot.data().token as string | undefined)
    .filter((token): token is string => Boolean(token))
}

async function sumTransactions({
  userId,
  cardId,
  start,
  end,
}: {
  userId: string
  cardId: string
  start: Date
  end: Date
}) {
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

  return snapshot.docs.reduce((total, docSnapshot) => {
    const amount = docSnapshot.data().amount as number | undefined
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

async function processCardReminders(notificationEngine: NotificationEngine): Promise<void> {
  const cardsSnapshot = await firestore.collection('cards').get()
  if (cardsSnapshot.empty) {
    logger.info('No cards found for reminder processing.')
    return
  }

  const now = new Date()
  const dueThresholds = new Set([7, 3, 1, 0])

  for (const cardDoc of cardsSnapshot.docs) {
    const card = cardDoc.data() as {
      userId?: string
      statementDay?: number
      dueDay?: number
      limitAmount?: number
      alias?: string
      issuer?: string
      last4?: string
    }

    const userId = typeof card.userId === 'string' ? card.userId : undefined
    if (!userId || typeof card.statementDay !== 'number' || typeof card.dueDay !== 'number') {
      continue
    }

    if (typeof card.limitAmount !== 'number') {
      continue
    }

    const cycle = computeCycle(now, card.statementDay)
    const dueDate = computeDueDate(cycle.end, card.dueDay)
    const daysToDue = calculateDaysLeft(now, dueDate)
    const currentDue = await sumTransactions({
      userId,
      cardId: cardDoc.id,
      start: cycle.start,
      end: cycle.end,
    })
    const utilization = card.limitAmount > 0 ? currentDue / card.limitAmount : 0
    const cardLabel = card.alias || card.issuer || `Card ${card.last4 ?? ''}`
    const reminders: ReminderEvent[] = []

    if (dueThresholds.has(daysToDue) || daysToDue < 0) {
      reminders.push({
        userId,
        cardId: cardDoc.id,
        eventKey: `card:${cardDoc.id}:due:${daysToDue}`,
        type: 'due-reminder',
        template: {
          kind: 'due',
          data: {
            cardLabel,
            daysToDue,
            dueDate,
            amount: currentDue,
          },
        },
      })
    }

    if (utilization >= 0.95) {
      reminders.push({
        userId,
        cardId: cardDoc.id,
        eventKey: `card:${cardDoc.id}:utilization:95`,
        type: 'utilization-95',
        template: {
          kind: 'utilization',
          data: {
            cardLabel,
            utilization,
            threshold: 95,
            limit: card.limitAmount,
            amount: currentDue,
          },
        },
      })
    } else if (utilization >= 0.8) {
      reminders.push({
        userId,
        cardId: cardDoc.id,
        eventKey: `card:${cardDoc.id}:utilization:80`,
        type: 'utilization-80',
        template: {
          kind: 'utilization',
          data: {
            cardLabel,
            utilization,
            threshold: 80,
            limit: card.limitAmount,
            amount: currentDue,
          },
        },
      })
    }

    for (const reminder of reminders) {
      await notificationEngine.deliverReminder(reminder)
    }
  }
}

async function processBudgetAlerts(notificationEngine: NotificationEngine): Promise<void> {
  const budgetsSnapshot = await firestore.collection('budgets').get()
  if (budgetsSnapshot.empty) {
    logger.info('No budgets found for alert processing.')
    return
  }

  for (const budgetDoc of budgetsSnapshot.docs) {
    const data = budgetDoc.data() as Record<string, unknown>
    const userId =
      typeof data.userId === 'string' && data.userId.trim().length > 0 ? data.userId.trim() : null
    if (!userId) {
      continue
    }

    const limit = toPositiveNumber(
      data.limitAmount ?? data.limit ?? data.amountLimit ?? data.total ?? null,
    )
    const spent = toPositiveNumber(
      data.spent ?? data.spentAmount ?? data.current ?? data.currentSpend ?? null,
    )
    const thresholds = normalizeThresholds(data.thresholds ?? data.alertThresholds ?? null)
    const budgetLabel = determineBudgetLabel(data, budgetDoc.id)

    if (limit <= 0 && spent <= 0) {
      continue
    }

    const usagePercentage = limit > 0 ? (spent / limit) * 100 : Number.POSITIVE_INFINITY

    for (const threshold of thresholds) {
      if (usagePercentage >= threshold) {
        await sendBudgetAlert(notificationEngine, {
          userId,
          budgetId: budgetDoc.id,
          budgetLabel,
          spent,
          limit,
          threshold,
        })
      }
    }
  }
}

function toPositiveNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

function normalizeThresholds(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : value != null ? [value] : [80, 100]
  const thresholds = raw
    .map((entry) => {
      const numeric = typeof entry === 'number' ? entry : Number(entry)
      return Number.isFinite(numeric) ? numeric : null
    })
    .filter((entry): entry is number => entry !== null)
    .map((entry) => Math.max(0, entry))

  if (thresholds.length === 0) {
    return [80, 100]
  }

  return Array.from(new Set(thresholds)).sort((a, b) => a - b)
}

function determineBudgetLabel(data: Record<string, unknown>, fallbackId: string): string {
  const labelCandidates = [
    data.budgetLabel,
    data.label,
    data.name,
    data.title,
    `Budget ${fallbackId}`,
  ]

  for (const candidate of labelCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return `Budget ${fallbackId}`
}

function normalizeError(error: unknown): { message: string } {
  if (error instanceof Error) {
    return { message: error.message }
  }
  return { message: 'Unknown error' }
}
