import { useEffect } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { NotificationItem } from './NotificationItem'
import { useNotifications } from '../hooks/useNotifications'
import { toUserMessage } from '../lib/uiError'

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

  const isAuthenticated = Boolean(userId)
  const hasNotifications = notifications.length > 0
  const showError = isAuthenticated && Boolean(error)
  const showLoading = isAuthenticated && loading
  const showEmpty = isAuthenticated && !loading && !error && !hasNotifications

  useEffect(() => {
    if (import.meta.env.DEV && error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load notifications', error)
    }
  }, [error])

  const handleRefresh = () => {
    void refresh()
  }

  const handleMarkAllRead = () => {
    void markAllRead()
  }

  const handleLoadMore = () => {
    void loadMore()
  }

  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            {t('notifications.center.title')}
          </h2>
          <p className="text-sm text-slate-500">
            {isAuthenticated
              ? t('notifications.center.subtitle', { count: unreadCount })
              : t('notifications.center.signInPrompt')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
            disabled={!isAuthenticated || loading}
          >
            <option value="all">{t('notifications.center.filters.all')}</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {typeLabel(type, t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isAuthenticated || loading}
          >
            {t('notifications.center.actions.refresh')}
          </button>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded border border-emerald-500 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isAuthenticated || loading || !hasNotifications}
          >
            {t('notifications.center.actions.markAllRead')}
          </button>
        </div>
      </header>

      {!isAuthenticated ? (
        <EmptyState title="請先登入" description="點右上角『用 Google 登入』以同步雲端資料。" />
      ) : null}

      {showLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
          {t('notifications.center.loading')}
        </div>
      ) : null}

      {showEmpty ? <EmptyState title="目前沒有通知" /> : null}

      {showError && error ? (
        <div className="space-y-3">
          <div className="rounded border border-red-500/60 bg-red-500/10 p-4 text-sm text-red-200 leading-relaxed break-words">
            {toUserMessage(error)}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
            disabled={loading}
          >
            重試
          </button>
        </div>
      ) : null}

      {isAuthenticated && !loading && !error && hasNotifications ? (
        <ul className="space-y-3 leading-relaxed">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={markRead}
            />
          ))}
        </ul>
      ) : null}

      {isAuthenticated && !loading && !error && hasMore ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleLoadMore}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
          >
            {t('notifications.center.actions.loadMore')}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-900/60 p-6 text-center leading-relaxed">
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
    </div>
  )
}

function typeLabel(type: string, t: TFunction<'common'>) {
  const key = `notifications.types.${type}`
  const translated = t(key)
  if (translated !== key) {
    return translated
  }
  return type.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export default NotificationCenter
