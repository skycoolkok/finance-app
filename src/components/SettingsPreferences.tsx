import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from './LanguageSwitcher'
import type { CurrencyCode } from '../lib/money'

type SettingsPreferencesProps = {
  preferredCurrency: CurrencyCode
  availableCurrencies: readonly CurrencyCode[]
  setPreferredCurrency: (currency: CurrencyCode) => Promise<void>
  currencyLoading: boolean
}

export function SettingsPreferences({
  preferredCurrency,
  availableCurrencies,
  setPreferredCurrency,
  currencyLoading,
}: SettingsPreferencesProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleCurrencyChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as CurrencyCode
    if (next === preferredCurrency) {
      return
    }

    setIsSaving(true)
    setError(null)
    setStatus(null)

    try {
      await setPreferredCurrency(next)
      const label = t(`settings.preferences.currency.options.${next}` as const)
      setStatus(t('settings.preferences.currency.updated', { currency: label }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header>
        <h2 className="text-xl font-semibold text-slate-100">
          {t('settings.preferences.title')}
        </h2>
        <p className="text-sm text-slate-500">{t('settings.preferences.subtitle')}</p>
      </header>

      {status && (
        <p className="rounded border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {status}
        </p>
      )}

      {error && (
        <p className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded border border-slate-800 bg-slate-950/50 p-4">
          <header>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t('settings.preferences.language.title')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('settings.preferences.language.description')}
            </p>
          </header>
          <LanguageSwitcher />
        </div>

        <div className="space-y-3 rounded border border-slate-800 bg-slate-950/50 p-4">
          <header>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t('settings.preferences.currency.title')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('settings.preferences.currency.description')}
            </p>
          </header>
          <select
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            value={preferredCurrency}
            onChange={(event) => {
              void handleCurrencyChange(event)
            }}
            disabled={isSaving || currencyLoading}
          >
            {availableCurrencies.map((code) => (
              <option key={code} value={code}>
                {t(`settings.preferences.currency.options.${code}` as const)}
              </option>
            ))}
          </select>
          {(isSaving || currencyLoading) && (
            <p className="text-xs text-slate-500">
              {t('settings.preferences.currency.saving')}
            </p>
          )}
        </div>
      </div>

      {import.meta.env.DEV && (
        <p className="text-xs text-slate-500">
          {t('settings.preferences.devSummary', { currency: preferredCurrency })}
        </p>
      )}
    </section>
  )
}

export default SettingsPreferences
