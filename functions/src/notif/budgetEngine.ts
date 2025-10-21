import * as admin from 'firebase-admin'
import type { Resend } from 'resend'

type PushPayload = {
  title: string
  body: string
  data?: Record<string, string>
}

type BudgetDocument = {
  userId?: string
  category?: string
  limit?: number
  period?: string
  startDate?: string | admin.firestore.Timestamp
  endDate?: string | admin.firestore.Timestamp
  spent?: number
}

type TransactionDocument = {
  userId?: string
  amount?: number
  category?: string
  date?: string | admin.firestore.Timestamp
}

export type BudgetSweepResult = {
  budgetId: string
  category: string
  spent: number
  limit: number
  thresholdTriggered: '80' | '100' | null
}

export type BudgetEngineDependencies = {
  firestore: admin.firestore.Firestore
  resendClient: Resend | null
  sendPushToUser: (
    userId: string,
    payload: PushPayload,
    options?: { cache?: Map<string, string[]> },
  ) => Promise<{ successCount: number; failureCount: number }>
  logNotification: (args: {
    userId: string
    type: string
    message: string
    channel: 'push' | 'email'
    eventKey: string
  }) => Promise<void>
  rememberNotificationKey: (
    userId: string,
    eventKey: string,
    channel: 'push' | 'email',
  ) => Promise<void>
  wasEventSentRecently: (
    userId: string,
    eventKey: string,
    channel: 'push' | 'email',
  ) => Promise<boolean>
  lookupUserEmail: (userId: string, cache: Map<string, string | null>) => Promise<string | null>
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export async function budgetEngine({
  firestore,
  resendClient,
  sendPushToUser,
  logNotification,
  rememberNotificationKey,
  wasEventSentRecently,
  lookupUserEmail,
}: BudgetEngineDependencies): Promise<BudgetSweepResult[]> {
  const budgetsSnapshot = await firestore.collection('budgets').get()
  if (budgetsSnapshot.empty) {
    return []
  }

  const tokenCache = new Map<string, string[]>()
  const emailCache = new Map<string, string | null>()
  const now = new Date()
  const results: BudgetSweepResult[] = []

  for (const docSnapshot of budgetsSnapshot.docs) {
    try {
      const data = docSnapshot.data() as BudgetDocument
      const budgetId = docSnapshot.id
      const userId = data.userId ?? ''
      const limit = typeof data.limit === 'number' ? data.limit : 0
      const category = (data.category ?? '').trim()

      if (!userId || limit <= 0 || !category) {
        results.push({
          budgetId,
          category,
          spent: data.spent ?? 0,
          limit,
          thresholdTriggered: null,
        })
        continue
      }

      const { startDate, endDate, periodStartISO } = resolvePeriodRange({
        period: data.period,
        startDate: data.startDate,
        endDate: data.endDate,
        reference: now,
      })

      if (!startDate || !endDate) {
        results.push({
          budgetId,
          category,
          spent: data.spent ?? 0,
          limit,
          thresholdTriggered: null,
        })
        continue
      }

      const startISO = toISODate(startDate)
      const endISO = toISODate(endDate)
      const normalizedCategory = sanitizeCategory(category)

      const transactionsSnapshot = await firestore
        .collection('transactions')
        .where('userId', '==', userId)
        .where('category', '==', category)
        .where('date', '>=', startISO)
        .where('date', '<=', endISO)
        .get()

      const spent = transactionsSnapshot.docs.reduce((total, txDoc) => {
        const tx = txDoc.data() as TransactionDocument
        if (sanitizeCategory(tx.category ?? '') !== normalizedCategory) {
          return total
        }
        const amount = typeof tx.amount === 'number' ? tx.amount : 0
        return total + Math.max(amount, 0)
      }, 0)

      if (data.spent !== spent) {
        await docSnapshot.ref.update({ spent })
      }

      const usage = spent / limit
      let thresholdTriggered: '80' | '100' | null = null
      if (usage >= 1) {
        thresholdTriggered = '100'
      } else if (usage >= 0.8) {
        thresholdTriggered = '80'
      }

      if (thresholdTriggered) {
        const eventKey = createBudgetNotificationKey(
          userId,
          normalizedCategory,
          periodStartISO,
          thresholdTriggered,
        )

        const percentage = Math.round(usage * 100)
        const spentLabel = formatCurrency(spent)
        const limitLabel = formatCurrency(limit)
        const message = `${category} budget spent ${spentLabel} of ${limitLabel} (${percentage}%).`
        const notificationType = thresholdTriggered === '100' ? 'budget-100' : 'budget-80'
        const pushTitle =
          thresholdTriggered === '100'
            ? `${category} budget reached 100%`
            : `${category} budget at 80%`

        const pushSentRecently = await wasEventSentRecently(userId, eventKey, 'push')
        if (!pushSentRecently) {
          const result = await sendPushToUser(
            userId,
            {
              title: pushTitle,
              body: message,
              data: {
                type: notificationType,
                budgetId,
                periodStart: periodStartISO,
                threshold: thresholdTriggered,
              },
            },
            { cache: tokenCache },
          )

          if (result.successCount + result.failureCount > 0) {
            await logNotification({
              userId,
              type: notificationType,
              message,
              channel: 'push',
              eventKey,
            })
            await rememberNotificationKey(userId, eventKey, 'push')
          }
        }

        if (resendClient) {
          const emailSentRecently = await wasEventSentRecently(userId, eventKey, 'email')
          if (!emailSentRecently) {
            const email = await lookupUserEmail(userId, emailCache)
            if (email) {
              await resendClient.emails.send({
                from: 'Finance App <notifications@finance-app.dev>',
                to: email,
                subject: pushTitle,
                html: `<h2>${pushTitle}</h2><p>${message}</p>`,
              })

              await logNotification({
                userId,
                type: notificationType,
                message,
                channel: 'email',
                eventKey,
              })
              await rememberNotificationKey(userId, eventKey, 'email')
            }
          }
        }
      }

      results.push({
        budgetId,
        category,
        spent,
        limit,
        thresholdTriggered,
      })
    } catch (error) {
      results.push({
        budgetId: docSnapshot.id,
        category: (docSnapshot.data() as BudgetDocument).category ?? '',
        spent: 0,
        limit: 0,
        thresholdTriggered: null,
      })
      console.error('budgetEngine: failed to process budget', {
        budgetId: docSnapshot.id,
        error,
      })
    }
  }

  return results
}

function resolvePeriodRange({
  period,
  startDate,
  endDate,
  reference,
}: {
  period?: string
  startDate?: string | admin.firestore.Timestamp
  endDate?: string | admin.firestore.Timestamp
  reference: Date
}) {
  const normalizedPeriod = (period ?? '').toLowerCase()
  let start: Date | null = null
  let end: Date | null = null

  if (normalizedPeriod === 'weekly') {
    const current = new Date(reference)
    const day = current.getDay() || 7
    start = new Date(current)
    start.setDate(current.getDate() - (day - 1))
    start.setHours(0, 0, 0, 0)

    end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  } else if (normalizedPeriod === 'monthly') {
    start = new Date(reference.getFullYear(), reference.getMonth(), 1)
    end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (normalizedPeriod === 'quarterly') {
    const quarter = Math.floor(reference.getMonth() / 3)
    start = new Date(reference.getFullYear(), quarter * 3, 1)
    end = new Date(reference.getFullYear(), quarter * 3 + 3, 0)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (normalizedPeriod === 'yearly') {
    start = new Date(reference.getFullYear(), 0, 1)
    end = new Date(reference.getFullYear(), 12, 0)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else {
    start = parseDateValue(startDate)
    end = parseDateValue(endDate)
  }

  if (start) {
    start.setHours(0, 0, 0, 0)
  }
  if (end) {
    end.setHours(23, 59, 59, 999)
  }

  return {
    startDate: start,
    endDate: end,
    periodStartISO: start ? toISODate(start) : '',
  }
}

function parseDateValue(value: string | admin.firestore.Timestamp | undefined): Date | null {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as admin.firestore.Timestamp).toDate()
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return null
}

function toISODate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0]
}

function sanitizeCategory(value: string) {
  return value.trim().toLowerCase()
}

function createBudgetNotificationKey(
  userId: string,
  category: string,
  periodStartISO: string,
  threshold: string,
) {
  return `budget#${userId}#${category}#${periodStartISO || 'custom'}#${threshold}`
}

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount)
}
