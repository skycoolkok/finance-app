import * as admin from 'firebase-admin'
import type { messaging } from 'firebase-admin'
import { logger as functionsLogger } from 'firebase-functions'
import type { Resend } from 'resend'
import {
  getTemplates,
  resolveLocaleTag,
  type BudgetAlertInput,
  type DueReminderInput,
  type NotificationContent,
  type NotificationTemplates,
  type UtilizationAlertInput,
} from '../templates'
import { renderEmailTemplate } from '../templates/renderer'
import { resolveClickRedirectUrl } from '../tracking/clickRedirect'
import { resolveOpenPixelUrl } from '../tracking/openPixel'
import { assignVariant, type AbVariant } from './abtest'
import { sanitizeForKey } from './utils'

type MessagingClient = messaging.Messaging
type Logger = typeof functionsLogger

export type ReminderTemplate =
  | { kind: 'due'; data: Omit<DueReminderInput, 'baseUrl'> }
  | { kind: 'utilization'; data: Omit<UtilizationAlertInput, 'baseUrl'> }
  | { kind: 'budget'; data: Omit<BudgetAlertInput, 'baseUrl'> }

export type ReminderEvent = {
  userId: string
  type: string
  eventKey: string
  template: ReminderTemplate
  cardId?: string
  budgetId?: string
}

export type NotificationLogRecord = {
  userId: string
  type: string
  message: string
  channel: 'push' | 'email'
  eventKey: string
  locale: string
  cardId?: string
  budgetId?: string
  abVariant?: AbVariant
  nid?: string
  metadata?: Record<string, unknown>
  tracking?: {
    openUrl?: string
    clickUrl?: string
  }
}

type NotificationEngineOptions = {
  firestore: FirebaseFirestore.Firestore
  messaging: MessagingClient
  resendClient: Resend | null
  notificationWindowMs: number
  baseUrl: string
  logger?: Logger
}

export class NotificationEngine {
  private readonly firestore: FirebaseFirestore.Firestore
  private readonly messaging: MessagingClient
  private readonly resendClient: Resend | null
  private readonly notificationWindowMs: number
  private readonly baseUrl: string
  private readonly logger: Logger

  private readonly tokenCache = new Map<string, string[]>()
  private readonly emailCache = new Map<string, string | null>()
  private readonly localeCache = new Map<string, string>()

  constructor(options: NotificationEngineOptions) {
    this.firestore = options.firestore
    this.messaging = options.messaging
    this.resendClient = options.resendClient
    this.notificationWindowMs = options.notificationWindowMs
    this.baseUrl = options.baseUrl
    this.logger = options.logger ?? functionsLogger
  }

  async deliverReminder(reminder: ReminderEvent): Promise<void> {
    const locale = await fetchUserLocale({
      firestore: this.firestore,
      userId: reminder.userId,
      cache: this.localeCache,
    })

    const templates = getTemplates(locale)
    const content = this.renderContent(templates, reminder.template)

    const abVariant = assignVariant({ userId: reminder.userId, eventKey: reminder.eventKey })

    await this.deliverPush(reminder, content, locale, abVariant)
    await this.deliverEmail(reminder, content, locale, abVariant)
  }

  async log(record: NotificationLogRecord): Promise<string> {
    return logNotificationRecord(this.firestore, record)
  }

  async resolveLocale(userId: string): Promise<string> {
    return fetchUserLocale({
      firestore: this.firestore,
      userId,
      cache: this.localeCache,
    })
  }

  private renderContent(
    templates: NotificationTemplates,
    template: ReminderTemplate,
  ): NotificationContent {
    switch (template.kind) {
      case 'due':
        return templates.dueReminder({
          ...template.data,
          baseUrl: this.baseUrl,
        })
      case 'utilization':
        return templates.utilizationAlert({
          ...template.data,
          baseUrl: this.baseUrl,
        })
      case 'budget':
        return templates.budgetAlert({
          ...template.data,
          baseUrl: this.baseUrl,
        })
      default: {
        const exhaustive: never = template
        throw new Error(`Unsupported template kind: ${JSON.stringify(exhaustive)}`)
      }
    }
  }

  private async deliverPush(
    reminder: ReminderEvent,
    content: NotificationContent,
    locale: string,
    abVariant: AbVariant,
  ): Promise<void> {
    const shouldSend = !(await this.wasEventSentRecently(reminder, 'push'))
    if (!shouldSend) {
      return
    }

    const tokens = await this.fetchUserTokens(reminder.userId)
    if (tokens.length === 0) {
      return
    }

    await this.messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: content.push.title,
        body: content.push.body,
      },
      data: this.composeDataPayload(reminder, locale, content.url, abVariant),
    })

    await this.log({
      userId: reminder.userId,
      type: reminder.type,
      message: content.summary,
      channel: 'push',
      eventKey: reminder.eventKey,
      locale,
      cardId: reminder.cardId,
      budgetId: reminder.budgetId,
      abVariant,
    })

    await this.rememberNotificationKey(reminder, 'push')
  }

  private async deliverEmail(
    reminder: ReminderEvent,
    content: NotificationContent,
    locale: string,
    abVariant: AbVariant,
  ): Promise<void> {
    if (!this.resendClient) {
      return
    }

    const shouldSend = !(await this.wasEventSentRecently(reminder, 'email'))
    if (!shouldSend) {
      return
    }

    const email = await this.lookupUserEmail(reminder.userId)
    if (!email) {
      return
    }

    const nid = this.firestore.collection('notifications').doc().id
    const resolvedLocale = resolveLocaleTag(locale)

    const baseOpenPixelUrl = resolveOpenPixelUrl(this.baseUrl)
    const baseClickRedirectUrl = resolveClickRedirectUrl(this.baseUrl)

    const openUrl = this.appendTrackingParams(baseOpenPixelUrl, {
      nid,
      uid: reminder.userId,
      variant: abVariant,
      event: reminder.eventKey,
      channel: 'email',
    })

    const clickUrl = this.appendTrackingParams(baseClickRedirectUrl, {
      nid,
      uid: reminder.userId,
      variant: abVariant,
      event: reminder.eventKey,
      channel: 'email',
      url: content.url,
    })

    const emailContext = {
      ...content.email.context,
      openUrl,
      clickUrl,
      ctaUrl: (content.email.context?.ctaUrl as string | undefined) ?? content.url,
      preferencesUrl:
        (content.email.context?.preferencesUrl as string | undefined) ??
        this.appendPath(this.baseUrl, '/settings/notifications'),
      logoUrl:
        (content.email.context?.logoUrl as string | undefined) ??
        this.appendPath(this.baseUrl, '/icons/icon-192.png'),
    }

    let html: string
    try {
      html = await renderEmailTemplate({
        locale: resolvedLocale,
        variant: abVariant,
        templateName: content.email.templateName,
        context: emailContext,
      })
    } catch (error) {
      this.logger.error('Failed to render email template', {
        error,
        locale: resolvedLocale,
        userId: reminder.userId,
        templateName: content.email.templateName,
        variant: abVariant,
      })
      return
    }

    try {
      await this.resendClient.emails.send({
        from: 'Finance App <notifications@finance-app.dev>',
        to: email,
        subject: content.email.subject,
        html,
        text: content.summary,
      })
    } catch (error) {
      this.logger.error('Failed to send email notification', {
        error,
        userId: reminder.userId,
        eventKey: reminder.eventKey,
      })
      return
    }

    await this.log({
      userId: reminder.userId,
      type: reminder.type,
      message: content.summary,
      channel: 'email',
      eventKey: reminder.eventKey,
      locale,
      cardId: reminder.cardId,
      budgetId: reminder.budgetId,
      abVariant,
      nid,
      tracking: {
        openUrl,
        clickUrl,
      },
    })

    await this.rememberNotificationKey(reminder, 'email')
  }

  private appendTrackingParams(
    base: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const candidates = [base, this.appendPath(this.baseUrl, base)]

    for (const candidate of candidates) {
      if (!candidate) {
        continue
      }
      try {
        const url = new URL(candidate)
        for (const [key, value] of Object.entries(params)) {
          if (value === undefined || value === null) {
            continue
          }
          url.searchParams.set(key, String(value))
        }
        return url.toString()
      } catch {
        continue
      }
    }

    return base
  }

  private appendPath(base: string, path: string): string {
    try {
      return new URL(path, this.ensureTrailingSlash(base)).toString()
    } catch {
      return base
    }
  }

  private ensureTrailingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`
  }

  private composeDataPayload(
    reminder: ReminderEvent,
    locale: string,
    url: string,
    abVariant: AbVariant,
  ): Record<string, string> {
    const data: Record<string, string> = {
      type: reminder.type,
      eventKey: reminder.eventKey,
      locale: resolveLocaleTag(locale),
      url,
      variant: abVariant,
    }
    if (reminder.cardId) {
      data.cardId = reminder.cardId
    }
    if (reminder.budgetId) {
      data.budgetId = reminder.budgetId
    }
    return data
  }

  private async fetchUserTokens(userId: string): Promise<string[]> {
    if (this.tokenCache.has(userId)) {
      return this.tokenCache.get(userId) ?? []
    }

    const snapshot = await this.firestore
      .collection('user_tokens')
      .where('userId', '==', userId)
      .get()

    const tokens = snapshot.docs
      .map((docSnapshot) => docSnapshot.data().token as string | undefined)
      .filter((token): token is string => typeof token === 'string' && token.length > 0)

    this.tokenCache.set(userId, tokens)
    return tokens
  }

  private async lookupUserEmail(userId: string): Promise<string | null> {
    if (this.emailCache.has(userId)) {
      return this.emailCache.get(userId) ?? null
    }

    const userRecord = await admin
      .auth()
      .getUser(userId)
      .catch(() => null)

    const email = userRecord?.email ?? null
    this.emailCache.set(userId, email)
    return email
  }

  private async wasEventSentRecently(
    reminder: ReminderEvent,
    channel: 'push' | 'email',
  ): Promise<boolean> {
    const docRef = this.notificationKeyRef(reminder.userId, reminder.eventKey, channel)
    const snapshot = await docRef.get()
    if (!snapshot.exists) {
      return false
    }

    const sentAt = snapshot.get('sentAt') as admin.firestore.Timestamp | undefined
    if (!sentAt) {
      return false
    }

    return sentAt.toMillis() >= Date.now() - this.notificationWindowMs
  }

  private async rememberNotificationKey(
    reminder: ReminderEvent,
    channel: 'push' | 'email',
  ): Promise<void> {
    const docRef = this.notificationKeyRef(reminder.userId, reminder.eventKey, channel)
    await docRef.set({
      userId: reminder.userId,
      eventKey: reminder.eventKey,
      channel,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }

  private notificationKeyRef(
    userId: string,
    eventKey: string,
    channel: 'push' | 'email',
  ): FirebaseFirestore.DocumentReference {
    const docId = sanitizeForKey(`${userId}:${channel}:${eventKey}`)
    return this.firestore.collection('notif_keys').doc(docId)
  }
}

export async function fetchUserLocale({
  firestore,
  userId,
  cache,
}: {
  firestore: FirebaseFirestore.Firestore
  userId: string
  cache?: Map<string, string>
}): Promise<string> {
  if (cache?.has(userId)) {
    return cache.get(userId) ?? 'en'
  }

  const snapshot = await firestore.collection('users').doc(userId).get()
  const docLocale = snapshot.exists ? snapshot.get('locale') : undefined
  const locale =
    typeof docLocale === 'string' && docLocale.trim().length > 0 ? docLocale.trim() : 'en'

  cache?.set(userId, locale)
  return locale
}

export async function logNotificationRecord(
  firestore: FirebaseFirestore.Firestore,
  record: NotificationLogRecord,
): Promise<string> {
  const collection = firestore.collection('notifications')
  const docRef = record.nid ? collection.doc(record.nid) : collection.doc()

  const payload: FirebaseFirestore.DocumentData = {
    userId: record.userId,
    type: record.type,
    message: record.message,
    channel: record.channel,
    eventKey: record.eventKey,
    locale: resolveLocaleTag(record.locale),
    cardId: record.cardId ?? null,
    budgetId: record.budgetId ?? null,
    nid: docRef.id,
    abVariant: record.abVariant ?? null,
    read: false,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  if (record.metadata) {
    payload.metadata = record.metadata
  }

  if (record.tracking) {
    payload.tracking = record.tracking
  }

  await docRef.set(payload, { merge: true })
  return docRef.id
}
