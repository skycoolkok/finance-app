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

if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, 'localhost', 8080)
}

let functionsInstance: Functions | null = null

function getFunctionsInstance() {
  if (!functionsInstance) {
    functionsInstance = getFunctions(app, 'us-central1')


    if (import.meta.env.DEV) {
      connectFunctionsEmulator(functionsInstance, 'localhost', 5001)
    }
  }

  return functionsInstance
}

export const functions = getFunctionsInstance()

export const messagingPromise: Promise<Messaging | null> = isSupported().then((supported) =>
  supported ? getMessaging(app) : null,
)
