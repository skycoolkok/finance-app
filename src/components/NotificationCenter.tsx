import { useEffect, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { NotificationItem } from './NotificationItem'
import { useNotifications } from '../hooks/useNotifications'
import { toUserMessage } from '../lib/uiError'

type NotificationCenterProps = {
  userId: string | null
  authReady: boolean
}

export function NotificationCenter({ userId, authReady }: NotificationCenterProps) {
  const { t } = useTranslation()
  const hookUserId = authReady ? userId : null
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
  } = useNotifications(hookUserId, { pageSize: 10 })

  const isAuthenticated = Boolean(userId)
  const hasNotifications = notifications.length > 0
  const showUnauthenticated = authReady && !isAuthenticated
  const showLoading = authReady && isAuthenticated && loading
  const showEmpty = authReady && isAuthenticated && !loading && !error && !hasNotifications
  const showError = authReady && isAuthenticated && Boolean(error)
  const showList = authReady && isAuthenticated && !loading && !error && hasNotifications
  const showLoadMore = showList && hasMore

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

  const handleRetry = () => {
    void refresh()
  }

  const disableActions = !authReady || !isAuthenticated || loading

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
            disabled={!authReady || !isAuthenticated || loading}
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
            disabled={disableActions}
          >
            {t('notifications.center.actions.refresh')}
          </button>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded border border-emerald-500 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disableActions || !hasNotifications}
          >
            {t('notifications.center.actions.markAllRead')}
          </button>
        </div>
      </header>

      {!authReady ? <MiniSpinner ariaLabel="checking-auth-state" /> : null}

      {showUnauthenticated ? (
        <Empty title="請先登入" description="點右上角『用 Google 登入』以同步雲端資料。" />
      ) : null}

      {showLoading ? <MiniSpinner ariaLabel="loading-notifications" /> : null}

      {showEmpty ? <Empty title="目前沒有通知" /> : null}

      {showError && error ? (
        <div className="space-y-3">
          <Alert variant="destructive">{toUserMessage(error)}</Alert>
          <Button onClick={handleRetry} disabled={loading}>
            重試
          </Button>
        </div>
      ) : null}

      {showList ? (
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

      {showLoadMore ? (
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

function Empty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-900/60 p-6 text-center leading-relaxed">
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
    </div>
  )
}

function MiniSpinner({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div className="flex justify-center py-4">
      <span
        aria-label={ariaLabel}
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent"
      />
    </div>
  )
}

function Alert({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: 'default' | 'destructive'
}) {
  const base = 'rounded border px-4 py-3 text-sm leading-relaxed'
  const styles =
    variant === 'destructive'
      ? 'border-red-500/60 bg-red-500/10 text-red-100'
      : 'border-slate-700 bg-slate-900 text-slate-200'
  return <div className={`${base} ${styles}`}>{children}</div>
}

function Button({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
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
