import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions'
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging'

export const firebaseConfig = {
  apiKey: 'AIzaSyBcTfagYzYGD3ZS6EkxuyZ2SdlVSUFGIJc',
  authDomain: 'finance-app-483fc.firebaseapp.com',
  projectId: 'finance-app-483fc',
  storageBucket: 'finance-app-483fc.firebasestorage.app',
  messagingSenderId: '467300077631',
  appId: '1:467300077631:web:66a3f4b384a70b4c83e88a',
}

export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

// 🔹 Firestore 模擬器（本地開發用）
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, 'localhost', 8080)
}

// -------------------------------------------------------------
// ✅ 這裡是主要修改重點：Functions 實例統一為 us-central1
// 並自動 fallback 到 asia-east1（避免舊版本部署地區不一致）
// -------------------------------------------------------------

let functionsInstance: Functions | null = null

function getFunctionsInstance() {
  if (!functionsInstance) {
    try {
      // 主要區域：與你目前部署的 callable functions 一致
      functionsInstance = getFunctions(app, 'us-central1')
    } catch (err) {
      console.warn('[Firebase] getFunctions(us-central1) failed, fallback to asia-east1', err)
      functionsInstance = getFunctions(app, 'asia-east1')
    }

    // 開發模式下連線到本地 emulator
    if (import.meta.env.DEV) {
      connectFunctionsEmulator(functionsInstance, 'localhost', 5001)
    }
  }

  return functionsInstance
}

export const functions = getFunctionsInstance()

// -------------------------------------------------------------
// ✅ Messaging
// -------------------------------------------------------------
export const messagingPromise: Promise<Messaging | null> = isSupported().then((supported) =>
  supported ? getMessaging(app) : null,
)
