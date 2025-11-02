import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { CurrencyCode, Rates } from '../lib/money'
import { buildId } from '../version'

type HealthCheckProps = {
  preferredCurrency: CurrencyCode
  currencyLoading: boolean
  rates: Rates
  ratesLoading: boolean
  ratesActive: boolean
  ratesEffectiveDate: string | null
  ratesSource: string | null
  ratesUpdatedAt: string | null
}

function readStoredLanguage(): string {
  if (typeof window === 'undefined') {
    return 'n/a'
  }
  try {
    return window.localStorage.getItem('lang') ?? '(null)'
  } catch {
    return '(error)'
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '(unknown)'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export function HealthCheck({
  preferredCurrency,
  currencyLoading,
  rates,
  ratesLoading,
  ratesActive,
  ratesEffectiveDate,
  ratesSource,
  ratesUpdatedAt,
}: HealthCheckProps) {
  const { i18n } = useTranslation()
  const [storedLanguage, setStoredLanguage] = useState<string>(() => readStoredLanguage())
  const timestamp = useMemo(() => new Date().toLocaleString(), [])

  useEffect(() => {
    setStoredLanguage(readStoredLanguage())
  }, [i18n.language])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'lang') {
        setStoredLanguage(readStoredLanguage())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const rateSummary = useMemo(() => {
    const entries = Object.entries(rates)
    const hasNonDefault = entries.some(([code, value]) => code !== 'TWD' && Number(value) > 0)
    const activeCodes = entries
      .filter(([code, value]) => code !== 'TWD' && Number(value) > 0)
      .map(([code]) => code)
      .join(', ')
    return {
      hasNonDefault,
      activeCodes,
    }
  }, [rates])

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-slate-950 p-6 text-slate-100">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Finance App · Health Check</h1>
          <span className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200">
            Build {buildId}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          {import.meta.env.DEV
            ? 'Development diagnostics'
            : 'Production diagnostics (non-sensitive)'}
        </p>
      </header>

      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">Build</h2>
        <dl className="grid gap-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">BuildId</dt>
            <dd>{buildId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">Mode</dt>
            <dd>{import.meta.env.DEV ? 'development' : 'production'}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">Localization</h2>
        <dl className="grid gap-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">i18n.language</dt>
            <dd>{i18n.language}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">localStorage.lang</dt>
            <dd>{storedLanguage}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">Preferences</h2>
        <dl className="grid gap-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">preferredCurrency</dt>
            <dd>
              {currencyLoading ? (
                <span className="text-amber-400">loading...</span>
              ) : (
                preferredCurrency
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">FX Rates</h2>
        <dl className="grid gap-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">loading</dt>
            <dd>{ratesLoading ? 'yes' : 'no'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">has rates</dt>
            <dd>{rateSummary.hasNonDefault ? 'yes' : 'no'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">active</dt>
            <dd>{ratesActive ? 'yes' : 'no'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">active codes</dt>
            <dd>{rateSummary.activeCodes || '(none)'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">effective date</dt>
            <dd>{ratesEffectiveDate ?? '(unknown)'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">updated at</dt>
            <dd>{formatDateTime(ratesUpdatedAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-slate-400">source</dt>
            <dd>{ratesSource ?? '(unknown)'}</dd>
          </div>
        </dl>
      </section>

      <footer className="text-xs text-slate-500">Last updated: {timestamp}</footer>
    </main>
  )
}

export default HealthCheck
