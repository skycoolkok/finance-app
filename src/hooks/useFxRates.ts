import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, type FirestoreError } from 'firebase/firestore'

import { db } from '../firebase'
import type { CurrencyCode, Rates } from '../lib/money'
import { SUPPORTED_CURRENCIES, fallbackRates } from '../lib/money'

type FxRatesState = {
  rates: Rates
  loading: boolean
  error: FirestoreError | null
}

const SUPPORTED_SET = new Set<CurrencyCode>(SUPPORTED_CURRENCIES)

export function useFxRates(): { rates: Rates; loading: boolean; error: FirestoreError | null } {
  const [state, setState] = useState<FxRatesState>(() => ({
    rates: fallbackRates,
    loading: true,
    error: null,
  }))

  useEffect(() => {
    const ratesQuery = query(
      collection(db, 'fx_rates'),
      orderBy('updatedAt', 'desc'),
      limit(1),
    )

    const unsubscribe = onSnapshot(
      ratesQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setState({ rates: fallbackRates, loading: false, error: null })
          return
        }

        const latest = snapshot.docs[0]
        const data = latest.data() as { rates?: Record<string, unknown> } | undefined
        if (!data?.rates) {
          setState({ rates: fallbackRates, loading: false, error: null })
          return
        }

        const sanitized: Rates = { TWD: 1 }
        for (const [code, raw] of Object.entries(data.rates)) {
          if (!SUPPORTED_SET.has(code as CurrencyCode)) {
            continue
          }
          const numeric = typeof raw === 'number' ? raw : Number(raw)
          if (Number.isFinite(numeric) && numeric > 0) {
            sanitized[code as CurrencyCode] = numeric
          }
        }

        if (!sanitized.TWD) {
          sanitized.TWD = 1
        }

        setState({ rates: { ...fallbackRates, ...sanitized }, loading: false, error: null })
      },
      (error) => {
        if (import.meta.env.DEV) {
          console.error('Failed to subscribe to fx rates', error)
        }
        setState({ rates: fallbackRates, loading: false, error })
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  return useMemo(
    () => ({
      rates: state.rates,
      loading: state.loading,
      error: state.error,
    }),
    [state.error, state.loading, state.rates],
  )
}
