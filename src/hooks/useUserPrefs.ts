import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc, type DocumentSnapshot } from 'firebase/firestore'
import i18next from 'i18next'

import { db } from '../firebase'
import type { CurrencyCode } from '../lib/money'
import {
  SUPPORTED_CURRENCIES,
  normalizeCurrency,
  persistCurrency,
  readStoredCurrency,
} from '../lib/money'
import {
  PREFERENCE_CHANGE_EVENT,
  type AppLocale,
  type PreferenceChangeDetail,
  normalizeLocale,
  setLocale,
} from '../lib/locale'

const STORAGE_KEY = 'preferredCurrency'

type UserPreferencesState = {
  preferredCurrency: CurrencyCode
  locale: AppLocale
  loading: boolean
}

export type UseUserPrefsResult = UserPreferencesState & {
  setPreferredCurrency: (currency: CurrencyCode) => Promise<void>
  availableCurrencies: readonly CurrencyCode[]
}

type SnapshotData = Record<string, unknown> | undefined

function extractCurrencyFromSnapshot(snapshot: DocumentSnapshot): CurrencyCode | null {
  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data() as SnapshotData
  if (!data) {
    return null
  }

  const value = data.preferredCurrency
  if (typeof value !== 'string') {
    return null
  }
  return normalizeCurrency(value)
}

function extractLocaleFromSnapshot(snapshot: DocumentSnapshot): AppLocale | null {
  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data() as SnapshotData
  if (!data) {
    return null
  }

  const value = data.locale
  if (typeof value !== 'string') {
    return null
  }
  return normalizeLocale(value)
}

function getInitialLocale(): AppLocale {
  const language =
    i18next?.resolvedLanguage ||
    i18next?.language ||
    (typeof window !== 'undefined' ? (window.localStorage.getItem('lang') ?? undefined) : undefined)
  return normalizeLocale(language)
}

export function useUserPrefs(userId: string | null | undefined): UseUserPrefsResult {
  const initialLocale = getInitialLocale()
  const [state, setState] = useState<UserPreferencesState>(() => ({
    preferredCurrency: readStoredCurrency(),
    locale: initialLocale,
    loading: Boolean(userId),
  }))
  const latestCurrencyRef = useRef<CurrencyCode>(state.preferredCurrency)
  const latestLocaleRef = useRef<AppLocale>(state.locale)

  useEffect(() => {
    latestCurrencyRef.current = state.preferredCurrency
  }, [state.preferredCurrency])

  useEffect(() => {
    latestLocaleRef.current = state.locale
  }, [state.locale])

  useEffect(() => {
    persistCurrency(latestCurrencyRef.current)
  }, [])

  useEffect(() => {
    if (!userId) {
      setState((prev) => ({
        preferredCurrency: prev.preferredCurrency,
        locale: prev.locale,
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
        const remoteLocale = extractLocaleFromSnapshot(snapshot)

        let nextCurrency = latestCurrencyRef.current
        if (remoteCurrency && remoteCurrency !== latestCurrencyRef.current) {
          nextCurrency = remoteCurrency
          latestCurrencyRef.current = remoteCurrency
          persistCurrency(remoteCurrency)
        }

        let nextLocale = latestLocaleRef.current
        if (remoteLocale && remoteLocale !== latestLocaleRef.current) {
          nextLocale = remoteLocale
          latestLocaleRef.current = remoteLocale
          setLocale(remoteLocale)
          void i18next.changeLanguage(remoteLocale)
        }

        setState({
          preferredCurrency: nextCurrency,
          locale: nextLocale,
          loading: false,
        })
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
      if (custom.detail?.type === 'currency') {
        const normalized = normalizeCurrency(custom.detail.value)
        if (normalized === latestCurrencyRef.current) {
          return
        }
        latestCurrencyRef.current = normalized
        setState((prev) => ({ ...prev, preferredCurrency: normalized }))
        return
      }

      if (custom.detail?.type === 'locale') {
        const normalized = normalizeLocale(custom.detail.value)
        if (normalized === latestLocaleRef.current) {
          return
        }
        latestLocaleRef.current = normalized
        setState((prev) => ({ ...prev, locale: normalized }))
      }
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
        await setDoc(doc(db, 'users', userId), { preferredCurrency: normalized }, { merge: true })
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
      locale: state.locale,
      loading: state.loading,
      setPreferredCurrency,
      availableCurrencies: SUPPORTED_CURRENCIES,
    }),
    [setPreferredCurrency, state.locale, state.loading, state.preferredCurrency],
  )
}
