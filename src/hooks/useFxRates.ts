import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type FirestoreError,
} from 'firebase/firestore'

import { db } from '../firebase'
import type { CurrencyCode, Rates } from '../lib/money'
import { SUPPORTED_CURRENCIES, fallbackRates } from '../lib/money'

type FxRatesState = {
  rates: Rates
  loading: boolean
  error: FirestoreError | null
  effectiveDate: string | null
  source: string | null
  active: boolean
}

const SUPPORTED_SET = new Set<CurrencyCode>(SUPPORTED_CURRENCIES)

function resolveEffectiveDate(docId: string | undefined, data: DocumentData | undefined) {
  if (data && typeof data.date === 'string' && data.date.trim()) {
    return data.date.trim()
  }
  if (typeof docId === 'string' && docId.trim()) {
    return docId.trim()
  }
  return null
}

function isActive(rates: Rates) {
  return Object.entries(rates).some(
    ([code, value]) => code !== 'TWD' && typeof value === 'number' && value > 0,
  )
}

export function useFxRates(): {
  rates: Rates
  loading: boolean
  error: FirestoreError | null
  effectiveDate: string | null
  source: string | null
  active: boolean
} {
  const [state, setState] = useState<FxRatesState>(() => ({
    rates: fallbackRates,
    loading: true,
    error: null,
    effectiveDate: null,
    source: null,
    active: false,
  }))

  useEffect(() => {
    const ratesQuery = query(collection(db, 'fx_rates'), orderBy('updatedAt', 'desc'), limit(1))

    const unsubscribe = onSnapshot(
      ratesQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setState({
            rates: fallbackRates,
            loading: false,
            error: null,
            effectiveDate: null,
            source: null,
            active: false,
          })
          return
        }

        const latest = snapshot.docs[0]
        const data = latest.data() as
          | {
              rates?: Record<string, unknown>
              source?: string
              date?: string
            }
          | undefined

        if (!data?.rates) {
          setState({
            rates: fallbackRates,
            loading: false,
            error: null,
            effectiveDate: resolveEffectiveDate(latest.id, data),
            source: typeof data?.source === 'string' ? data.source : null,
            active: false,
          })
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

        const merged = { ...fallbackRates, ...sanitized }
        setState({
          rates: merged,
          loading: false,
          error: null,
          effectiveDate: resolveEffectiveDate(latest.id, data),
          source: typeof data?.source === 'string' ? data.source : null,
          active: isActive(merged),
        })
      },
      (error) => {
        if (import.meta.env.DEV) {
          console.error('Failed to subscribe to fx rates', error)
        }
        setState({
          rates: fallbackRates,
          loading: false,
          error,
          effectiveDate: null,
          source: null,
          active: false,
        })
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
      effectiveDate: state.effectiveDate,
      source: state.source,
      active: state.active,
    }),
    [state.active, state.effectiveDate, state.error, state.loading, state.rates, state.source],
  )
}
