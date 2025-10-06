// src/messaging.ts
import { getToken, onMessage, isSupported } from 'firebase/messaging'
import type { Messaging } from 'firebase/messaging'
import { getAuth } from 'firebase/auth'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { messagingPromise } from './firebase' // 沿用你現有的封裝

const TOKEN_STORAGE_PREFIX = 'finance-app:fcmToken/'
let onMessageBound = false

async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  const current = Notification.permission
  if (current === 'granted' || current === 'denied') return current
  return await Notification.requestPermission()
}

/**
 * 1) 檢查支援與權限
 * 2) 取得 token（用 .env 的 VITE_FIREBASE_VAPID_KEY）
 * 3) 存到 Firestore: users/{uid}/fcmTokens/{token}
 * 4) 綁定 onMessage（前景通知）
 */
export async function initFcmAndRegister(userId: string | null) {
  if (typeof window === 'undefined') return
  if (!userId) return

  if (!(await isSupported())) {
    console.warn('Firebase Messaging 不被此環境支援')
    return
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('此瀏覽器不支援 Service Worker，無法註冊 FCM')
    return
  }

  let messaging: Messaging | null = null
  try {
    messaging = await messagingPromise
  } catch (e) {
    console.warn('取得 messaging 失敗：', e)
  }
  if (!messaging) return

  const permission = await ensureNotificationPermission()
  if (permission !== 'granted') {
    console.warn('使用者未授權通知')
    return
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
  if (!vapidKey) {
    console.warn('缺少 VAPID 公鑰：請在 .env 設定 VITE_FIREBASE_VAPID_KEY')
    return
  }

  const swReg = await navigator.serviceWorker.ready

  let token: string | null = null
  try {
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg })
  } catch (e) {
    console.warn('getToken 發生錯誤：', e)
    return
  }
  if (!token) {
    console.warn('未能取得 FCM token')
    return
  }

  const auth = getAuth()
  const db = getFirestore()
  const uid = userId ?? auth.currentUser?.uid ?? 'TEST_UID'
  await setDoc(
    doc(db, `users/${uid}/fcmTokens/${token}`),
    {
      createdAt: Date.now(),
      ua: navigator.userAgent ?? '',
    },
    { merge: true },
  )

  if (!onMessageBound) {
    onMessage(messaging, payload => {
      console.log('收到前景通知：', payload)
      // TODO: 這裡可以接你的 UI（Toast/Modal）
    })
    onMessageBound = true
  }

  localStorage.setItem(TOKEN_STORAGE_PREFIX + uid, token)
  return token
}
