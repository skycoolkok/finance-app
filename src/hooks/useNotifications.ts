import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'

export type UserNotification = {
  id: string
  type: string
  message: string
  channel: string
  sentAt: Date | null
  read: boolean
  eventKey?: string
  locale?: string
}

export type UseNotificationsOptions = {
  pageSize?: number
}

type HookState = {
  notifications: UserNotification[]
  loading: boolean
  error: string | null
  filterType: string
  availableTypes: string[]
  hasMore: boolean
  markRead: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<number>
  loadMore: () => Promise<void>
  setFilterType: (next: string) => void
  refresh: () => Promise<void>
  unreadCount: number
}

const DEFAULT_PAGE_SIZE = 10

export function useNotifications(
  userId: string | null,
  options?: UseNotificationsOptions,
): HookState {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE

  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [hasMore, setHasMore] = useState(false)

  const lastVisibleRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const pendingRef = useRef(false)

  const resetPagination = useCallback(() => {
    lastVisibleRef.current = null
    setHasMore(false)
  }, [])

  const mapNotification = useCallback(
    (snapshot: QueryDocumentSnapshot<DocumentData>): UserNotification => {
      const data = snapshot.data()
      const sentAtRaw = data.sentAt as { toDate?: () => Date } | Date | undefined
      let sentAt: Date | null = null
      if (sentAtRaw instanceof Date) {
        sentAt = sentAtRaw
      } else if (sentAtRaw && typeof sentAtRaw.toDate === 'function') {
        sentAt = sentAtRaw.toDate()
      }

      return {
        id: snapshot.id,
        type: typeof data.type === 'string' ? data.type : 'general',
        message: typeof data.message === 'string' ? data.message : '',
        channel: typeof data.channel === 'string' ? data.channel : 'push',
        sentAt,
        read: Boolean(data.read),
        eventKey: typeof data.eventKey === 'string' ? data.eventKey : undefined,
        locale: typeof data.locale === 'string' ? data.locale : undefined,
      }
    },
    [],
  )

  const fetchPage = useCallback(
    async (reset = false) => {
      if (!userId || pendingRef.current) {
        return
      }

      pendingRef.current = true
      setLoading(true)
      setError(null)

      try {
        const constraints: QueryConstraint[] = [where('userId', '==', userId)]

        if (filterType !== 'all') {
          constraints.push(where('type', '==', filterType))
        }

        constraints.push(orderBy('sentAt', 'desc'), limit(pageSize))

        if (!reset && lastVisibleRef.current) {
          constraints.push(startAfter(lastVisibleRef.current))
        }

        if (reset) {
          lastVisibleRef.current = null
        }

        const snapshot = await getDocs(query(collection(db, 'notifications'), ...constraints))

        if (snapshot.docs.length > 0) {
          lastVisibleRef.current = snapshot.docs[snapshot.docs.length - 1]
        }

        const newNotifications = snapshot.docs.map(mapNotification)

        setNotifications((prev) => (reset ? newNotifications : [...prev, ...newNotifications]))
        setHasMore(snapshot.docs.length === pageSize)
        setAvailableTypes((prev) => {
          const base = new Set<string>(reset ? [] : prev)
          newNotifications.forEach((item) => base.add(item.type))
          return Array.from(base).sort()
        })
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
      } finally {
        setLoading(false)
        pendingRef.current = false
      }
    },
    [filterType, mapNotification, pageSize, userId],
  )

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setAvailableTypes([])
      resetPagination()
      setLoading(false)
      return
    }

    resetPagination()
    fetchPage(true).catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
    })
  }, [fetchPage, resetPagination, userId, filterType])

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!userId) {
        return
      }

      await updateDoc(doc(db, 'notifications', notificationId), { read: true })

      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
      )
    },
    [userId],
  )

  const markAllRead = useCallback(async () => {
    if (!userId) {
      return 0
    }

    const unreadSnapshot = await getDocs(
      query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false),
      ),
    )

    if (unreadSnapshot.empty) {
      return 0
    }

    const batch = writeBatch(db)
    unreadSnapshot.docs.forEach((docSnapshot) => {
      batch.update(docSnapshot.ref, { read: true })
    })

    await batch.commit()

    const updatedIds = new Set(unreadSnapshot.docs.map((docSnapshot) => docSnapshot.id))
    setNotifications((prev) =>
      prev.map((item) => (updatedIds.has(item.id) ? { ...item, read: true } : item)),
    )

    return updatedIds.size
  }, [userId])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) {
      return
    }

    await fetchPage(false)
  }, [fetchPage, hasMore, loading])

  const refresh = useCallback(async () => {
    resetPagination()
    await fetchPage(true)
  }, [fetchPage, resetPagination])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  )

  return {
    notifications,
    loading,
    error,
    filterType,
    availableTypes,
    hasMore,
    markRead,
    markAllRead,
    loadMore,
    setFilterType,
    refresh,
    unreadCount,
  }
}
