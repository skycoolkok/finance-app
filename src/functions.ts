import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import type { CurrencyCode } from './lib/money'
import { app } from './firebase'

// 初始化 Functions
const fns = getFunctions(app, 'asia-east1')

// 只在本機環境連 emulator
if (location.hostname === 'localhost') {
  connectFunctionsEmulator(fns, 'localhost', 5001)
}

// 建立 callable
export const sendTestPush = httpsCallable(fns, 'sendTestPush')
export const ping = httpsCallable(fns, 'ping')
export const setUserLocale = httpsCallable<{ locale: string }, { locale: string }>(
  fns,
  'setUserLocale',
)
export const setFxRates = httpsCallable<
  { date?: string; rates: Partial<Record<CurrencyCode, number>>; source?: 'manual' | 'api' },
  { date: string; count: number; source: 'manual' | 'api' }
>(fns, 'setFxRates')
