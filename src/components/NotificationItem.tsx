import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { type UserNotification } from '../hooks/useNotifications'
import { formatDate } from '../lib/fmt'

type NotificationItemProps = {
  notification: UserNotification
  onMarkRead?: (id: string) => void | Promise<void>
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const { t, i18n } = useTranslation()
  const { id, message, type, channel, sentAt, read } = notification
  const locale = i18n.resolvedLanguage || i18n.language

  const handleMarkRead = () => {
    if (read || !onMarkRead) {
      return
    }
    void onMarkRead(id)
  }

  return (
    <li
      className={`rounded border border-slate-800 p-4 transition ${
        read ? 'bg-slate-900/40 opacity-80' : 'bg-slate-900/80'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${typeColor(
                type,
              )}`}
            >
              {typeLabel(type, t)}
            </span>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {t(`notifications.channels.${channel}`, { defaultValue: channel })}
            </span>
            {!read && <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />}
          </div>
          <p className="text-sm text-slate-200">{message}</p>
          {sentAt && (
            <p className="text-xs text-slate-500">
              {formatDate(sentAt, locale, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleMarkRead}
          disabled={read || !onMarkRead}
          className={`rounded border px-3 py-1 text-xs font-medium transition ${
            read
              ? 'cursor-default border-slate-700 text-slate-500'
              : 'border-emerald-500 text-emerald-400 hover:bg-emerald-500/10'
          }`}
        >
          {read ? t('notifications.item.read') : t('notifications.item.markRead')}
        </button>
      </div>
    </li>
  )
}

function typeLabel(type: string, t: TFunction<'common'>) {
  const key = `notifications.types.${type}`
  const translated = t(key)
  if (translated !== key) {
    return translated
  }
  return type.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function typeColor(type: string) {
  switch (type) {
    case 'due-reminder':
      return 'bg-amber-500/20 text-amber-400'
    case 'utilization-95':
      return 'bg-red-500/20 text-red-400'
    case 'utilization-80':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'test-email':
    case 'test-push':
      return 'bg-slate-700/40 text-slate-200'
    default:
      return 'bg-slate-700/40 text-slate-200'
  }
}
