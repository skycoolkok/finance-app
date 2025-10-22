import { getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { messagingPromise } from './firebase'

const SW_URL = '/firebase-messaging-sw.js'
const TOKEN_STORAGE_PREFIX = 'finance-app:fcmToken/'
let onMessageBound = false

const isSecureContext = () =>
  typeof window !== 'undefined' &&
  (window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost')

async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported in this environment.')
    return null
  }

  if (!isSecureContext()) {
    console.warn(
      'Firebase Messaging requires HTTPS or localhost. Service worker registration skipped.',
    )
    return null
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_URL)
    if (existing) {
      return existing
    }
    return await navigator.serviceWorker.register(SW_URL)
  } catch (error) {
    console.error('Failed to register messaging service worker', error)
    return null
  }
}

async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }

  const current = Notification.permission
  if (current === 'granted' || current === 'denied') {
    return current
  }

  return await Notification.requestPermission()
}

async function saveToken(userId: string, token: string) {
  try {
    const db = getFirestore()
    await setDoc(
      doc(db, `users/${userId}/fcmTokens/${token}`),
      {
        createdAt: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      },
      { merge: true },
    )
  } catch (error) {
    console.error('Failed to persist FCM token', error)
  }
}

async function bindForegroundMessaging(messaging: Messaging) {
  if (onMessageBound) {
    return
  }

  onMessage(messaging, payload => {
    console.info('Foreground notification received', payload)
    // TODO: display UI (toast/dialog) here if desired
  })

  onMessageBound = true
}

export async function initFcmAndRegister(userId: string | null) {
  if (typeof window === 'undefined') {
    return null
  }

  if (!userId) {
    console.warn('initFcmAndRegister: userId is required to register a device token.')
    return null
  }

  if (!(await isSupported())) {
    console.warn('Firebase Messaging is not supported in this browser.')
    return null
  }

  const registration = await registerServiceWorker()
  if (!registration) {
    return null
  }

  let messaging: Messaging | null = null
  try {
    messaging = await messagingPromise
  } catch (error) {
    console.error('Unable to initialise Firebase messaging instance', error)
    return null
  }

  if (!messaging) {
    return null
  }

  const permission = await ensureNotificationPermission()
  if (permission !== 'granted') {
    console.warn('Notification permission denied; skipping FCM registration.')
    return null
  }

  const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined
  if (!vapidKey) {
    console.warn('Missing VITE_FCM_VAPID_KEY; cannot request FCM token.')
    return null
  }

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (!token) {
      console.warn('FCM token could not be retrieved.')
      return null
    }

    const auth = getAuth()
    const uid = userId ?? auth.currentUser?.uid
    if (!uid) {
      console.warn('No authenticated user found; skipping token persistence.')
      return token
    }

    await saveToken(uid, token)
    localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${uid}`, token)
    await bindForegroundMessaging(messaging)

    return token
  } catch (error) {
    console.error('Failed to obtain FCM token', error)
    return null
  }
}
