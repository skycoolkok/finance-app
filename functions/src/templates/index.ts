import enNotificationTemplates from './en/notification'
import zhTwNotificationTemplates from './zh-TW/notification'
import type { NotificationTemplates } from './types'

const TEMPLATE_REGISTRY = new Map<string, NotificationTemplates>([
  ['en', enNotificationTemplates],
  ['en-US', enNotificationTemplates],
  ['en-GB', enNotificationTemplates],
  ['zh-TW', zhTwNotificationTemplates],
  ['zh', zhTwNotificationTemplates],
  ['zh-Hant', zhTwNotificationTemplates],
])

export function getTemplates(locale: string | null | undefined): NotificationTemplates {
  const normalized = resolveLocaleTag(locale)
  return TEMPLATE_REGISTRY.get(normalized) ?? enNotificationTemplates
}

export function resolveLocaleTag(locale: string | null | undefined): string {
  if (!locale) {
    return 'en'
  }

  const trimmed = locale.trim()
  if (!trimmed) {
    return 'en'
  }

  const lower = trimmed.toLowerCase()
  for (const key of TEMPLATE_REGISTRY.keys()) {
    if (key.toLowerCase() === lower) {
      return key
    }
  }

  const prefix = lower.split(/[-_]/)[0]
  for (const key of TEMPLATE_REGISTRY.keys()) {
    if (key.toLowerCase().startsWith(prefix)) {
      return key
    }
  }

  return 'en'
}

export type {
  NotificationContent,
  BudgetAlertInput,
  DueReminderInput,
  UtilizationAlertInput,
  NotificationTemplates,
} from './types'
