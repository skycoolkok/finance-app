import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc, type DocumentSnapshot } from 'firebase/firestore'

import { db } from '../firebase'
import type { CurrencyCode } from '../lib/money'
import {
  SUPPORTED_CURRENCIES,
  normalizeCurrency,
  persistCurrency,
  readStoredCurrency,
} from '../lib/money'
import { PREFERENCE_CHANGE_EVENT, type PreferenceChangeDetail } from '../lib/locale'

const STORAGE_KEY = 'preferredCurrency'

type UserPreferencesState = {
  preferredCurrency: CurrencyCode
  loading: boolean
}

export type UseUserPrefsResult = UserPreferencesState & {
  setPreferredCurrency: (currency: CurrencyCode) => Promise<void>
  availableCurrencies: readonly CurrencyCode[]
}

function extractCurrencyFromSnapshot(snapshot: DocumentSnapshot): CurrencyCode | null {
  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data() as Record<string, unknown>
  if (!data) {
    return null
  }

  const value = data.preferredCurrency
  if (typeof value !== 'string') {
    return null
  }
  return normalizeCurrency(value)
}

export function useUserPrefs(userId: string | null | undefined): UseUserPrefsResult {
  const [state, setState] = useState<UserPreferencesState>(() => ({
    preferredCurrency: readStoredCurrency(),
    loading: Boolean(userId),
  }))
  const latestCurrencyRef = useRef<CurrencyCode>(state.preferredCurrency)

  useEffect(() => {
    latestCurrencyRef.current = state.preferredCurrency
  }, [state.preferredCurrency])

  useEffect(() => {
    if (!userId) {
      setState((prev) => ({
        preferredCurrency: prev.preferredCurrency,
        loading: false,
      }))
      return
    }

    const userDocRef = doc(db, 'users', userId)
    let cancelled = false

    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (cancelled) {
          return
        }
        const remoteCurrency = extractCurrencyFromSnapshot(snapshot)
        if (!remoteCurrency) {
          setState({ preferredCurrency: latestCurrencyRef.current, loading: false })
          return
        }

        if (remoteCurrency !== latestCurrencyRef.current) {
          latestCurrencyRef.current = remoteCurrency
          persistCurrency(remoteCurrency)
          setState({ preferredCurrency: remoteCurrency, loading: false })
        } else {
          setState((prev) => ({ ...prev, loading: false }))
        }
      },
      () => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false }))
        }
      },
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [userId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return
      }
      const normalized = normalizeCurrency(event.newValue ?? undefined)
      if (normalized === latestCurrencyRef.current) {
        return
      }
      latestCurrencyRef.current = normalized
      setState((prev) => ({ ...prev, preferredCurrency: normalized }))
    }

    const handlePreferenceChange = (event: Event) => {
      const custom = event as CustomEvent<PreferenceChangeDetail>
      if (custom.detail?.type !== 'currency') {
        return
      }
      const normalized = normalizeCurrency(custom.detail.value)
      if (normalized === latestCurrencyRef.current) {
        return
      }
      latestCurrencyRef.current = normalized
      setState((prev) => ({ ...prev, preferredCurrency: normalized }))
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(PREFERENCE_CHANGE_EVENT, handlePreferenceChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(PREFERENCE_CHANGE_EVENT, handlePreferenceChange)
    }
  }, [])

  const setPreferredCurrency = useCallback(
    async (currency: CurrencyCode) => {
      const normalized = normalizeCurrency(currency)
      latestCurrencyRef.current = normalized
      persistCurrency(normalized)
      setState((prev) => ({ ...prev, preferredCurrency: normalized }))

      if (!userId) {
        return
      }

      try {
        await setDoc(
          doc(db, 'users', userId),
          { preferredCurrency: normalized },
          { merge: true },
        )
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to persist preferred currency', error)
        }
        throw error instanceof Error ? error : new Error(String(error))
      }
    },
    [userId],
  )

  return useMemo(
    () => ({
      preferredCurrency: state.preferredCurrency,
      loading: state.loading,
      setPreferredCurrency,
      availableCurrencies: SUPPORTED_CURRENCIES,
    }),
    [setPreferredCurrency, state.loading, state.preferredCurrency],
  )
}
