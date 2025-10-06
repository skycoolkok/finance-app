import { NotificationItem } from './NotificationItem'
import { useNotifications } from '../hooks/useNotifications'

type NotificationCenterProps = {
  userId: string | null
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
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
          <h2 className="text-xl font-semibold text-slate-100">Notifications</h2>
          <p className="text-sm text-slate-500">Sign in to view your reminders.</p>
        </header>
      </section>
    )
  }

  const showLoadMore = hasMore && !loading

  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Notifications</h2>
          <p className="text-sm text-slate-500">
            Stay on top of your due dates and utilization alerts. Unread: {unreadCount}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={event => setFilterType(event.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          >
            <option value="all">All types</option>
            {availableTypes.map(type => (
              <option key={type} value={type}>
                {typeLabel(type)}
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
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              void markAllRead()
            }}
            className="rounded border border-emerald-500 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10"
            disabled={loading || notifications.length === 0}
          >
            Mark all read
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {notifications.length === 0 && !loading ? (
        <p className="text-sm text-slate-500">
          No notifications yet. You’ll see reminders here once they arrive.
        </p>
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
        {loading && <span className="text-sm text-slate-500">Loading...</span>}
        {showLoadMore && (
          <button
            type="button"
            onClick={() => {
              void loadMore()
            }}
            className="ml-auto rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60"
          >
            Load more
          </button>
        )}
      </div>
    </section>
  )
}

function typeLabel(type: string) {
  switch (type) {
    case 'due-reminder':
      return 'Due Reminder'
    case 'utilization-80':
      return 'Utilization >=80%'
    case 'utilization-95':
      return 'Utilization >=95%'
    case 'test-push':
      return 'Test Push'
    case 'test-email':
      return 'Test Email'
    default:
      return type.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

export default NotificationCenter
