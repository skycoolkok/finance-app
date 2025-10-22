import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { NotificationItem } from './NotificationItem'
import { useNotifications } from '../hooks/useNotifications'

type NotificationCenterProps = {
  userId: string | null
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const { t } = useTranslation()
  const {
    notifications,
    loading,
    error,
    filterType,
    availableTypes,
    hasMore,
    setFilterType,
    loadMore,
    markRead,
    markAllRead,
    refresh,
    unreadCount,
  } = useNotifications(userId, { pageSize: 10 })

  if (!userId) {
    return (
      <section className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
        <header>
          <h2 className="text-xl font-semibold text-slate-100">
            {t('notifications.center.title')}
          </h2>
          <p className="text-sm text-slate-500">{t('notifications.center.signInPrompt')}</p>
        </header>
      </section>
    )
  }

  const showLoadMore = hasMore && !loading

  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            {t('notifications.center.title')}
          </h2>
          <p className="text-sm text-slate-500">
            {t('notifications.center.subtitle', { count: unreadCount })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={event => setFilterType(event.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          >
            <option value="all">{t('notifications.center.filters.all')}</option>
            {availableTypes.map(type => (
              <option key={type} value={type}>
                {typeLabel(type, t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              void refresh()
            }}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60"
            disabled={loading}
          >
            {t('notifications.center.actions.refresh')}
          </button>
          <button
            type="button"
            onClick={() => {
              void markAllRead()
            }}
            className="rounded border border-emerald-500 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10"
            disabled={loading || notifications.length === 0}
          >
            {t('notifications.center.actions.markAllRead')}
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {notifications.length === 0 && !loading ? (
        <p className="text-sm text-slate-500">{t('notifications.center.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={markRead}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        {loading && (
          <span className="text-sm text-slate-500">{t('notifications.center.loading')}</span>
        )}
        {showLoadMore && (
          <button
            type="button"
            onClick={() => {
              void loadMore()
            }}
            className="ml-auto rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60"
          >
            {t('notifications.center.actions.loadMore')}
          </button>
        )}
      </div>
    </section>
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

export default NotificationCenter
