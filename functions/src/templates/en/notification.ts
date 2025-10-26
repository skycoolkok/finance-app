import type { DueReminderInput, NotificationContent, NotificationTemplates } from '../types'

const CURRENCY = 'USD'

const templates: NotificationTemplates = {
  dueReminder: (input) => {
    const url = resolveUrl(input.baseUrl, '/cards')
    const amount = formatCurrency(input.amount)
    const dueDate = formatDate(input.dueDate)
    const summary = formatDueSummary(input, amount, dueDate)
    const subject = 'Card payment reminder'

    return buildNotification({
      subject,
      summary,
      url,
      facts: [`Card: ${input.cardLabel}`, `Due date: ${dueDate}`, `Balance: ${amount}`],
      ctaText: 'Review card activity',
      baseUrl: input.baseUrl,
    })
  },

  utilizationAlert: (input) => {
    const url = resolveUrl(input.baseUrl, '/cards')
    const percent = Math.round(input.utilization * 100)
    const limit = formatCurrency(input.limit)
    const amount = formatCurrency(input.amount)
    const isCritical = input.threshold >= 95
    const subject = isCritical ? 'High utilization alert' : 'Utilization warning'

    const summary = `${input.cardLabel} is at ${percent}% of its credit limit (balance ${amount} of ${limit}).`

    return buildNotification({
      subject,
      summary,
      url,
      facts: [`Card: ${input.cardLabel}`, `Current balance: ${amount}`, `Credit limit: ${limit}`],
      ctaText: 'Open cards dashboard',
      baseUrl: input.baseUrl,
    })
  },

  budgetAlert: (input) => {
    const url = resolveUrl(input.baseUrl, '/budgets')
    const spent = formatCurrency(input.spent)
    const limit = formatCurrency(input.limit)
    const percent = Math.round(input.percentage * 100)
    const subject =
      input.percentage >= 1
        ? 'Budget exceeded'
        : `Budget reached ${Math.max(percent, input.threshold)}%`
    const summary =
      input.percentage >= 1
        ? `${input.budgetLabel} exceeded its budget (spent ${spent} of ${limit}).`
        : `${input.budgetLabel} is at ${percent}% of its budget (spent ${spent} of ${limit}).`

    return buildNotification({
      subject,
      summary,
      url,
      facts: [`Budget: ${input.budgetLabel}`, `Spent: ${spent}`, `Limit: ${limit}`],
      ctaText: 'Review budget details',
      baseUrl: input.baseUrl,
    })
  },
}

export default templates

function formatDueSummary(input: DueReminderInput, amount: string, dueDate: string): string {
  if (input.daysToDue < 0) {
    return `${input.cardLabel} payment was due on ${dueDate}. Outstanding balance: ${amount}.`
  }
  if (input.daysToDue === 0) {
    return `${input.cardLabel} payment is due today (${dueDate}). Balance: ${amount}.`
  }
  if (input.daysToDue === 1) {
    return `${input.cardLabel} payment is due tomorrow (${dueDate}). Balance: ${amount}.`
  }
  return `${input.cardLabel} payment is due in ${input.daysToDue} days on ${dueDate}. Balance: ${amount}.`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(date)
}

function resolveUrl(baseUrl: string, path: string): string {
  try {
    return new URL(path, ensureTrailingSlash(baseUrl)).toString()
  } catch {
    return path
  }
}

function ensureTrailingSlash(baseUrl: string): string {
  if (!baseUrl.endsWith('/')) {
    return `${baseUrl}/`
  }
  return baseUrl
}

type BuildOptions = {
  subject: string
  summary: string
  url: string
  facts: string[]
  ctaText: string
  baseUrl: string
}

function buildNotification(options: BuildOptions): NotificationContent {
  const preferencesUrl = resolveUrl(options.baseUrl, '/settings/notifications')
  const logoUrl = resolveUrl(options.baseUrl, '/icons/icon-192.png')

  return {
    summary: options.summary,
    push: {
      title: options.subject,
      body: options.summary,
    },
    email: {
      subject: options.subject,
      templateName: 'email',
      context: {
        heading: options.subject,
        intro: options.summary,
        facts: options.facts,
        ctaText: options.ctaText,
        ctaUrl: options.url,
        preferencesUrl,
        logoUrl,
      },
    },
    url: options.url,
  }
}
