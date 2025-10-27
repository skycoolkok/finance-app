import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { CurrencyCode, Rates } from '../lib/money'
import { setFxRates } from '../functions'

type FxRatesAdminProps = {
  userEmail: string | null
  rates: Rates
  active: boolean
  effectiveDate: string | null
  source: string | null
}

type FormRates = Record<CurrencyCode, string>

const MANAGED_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'JPY', 'KRW']

function parseAdminEmails(): string[] {
  const envList = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ?? ''
  const parsed = envList
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  if (parsed.length > 0) {
    return parsed
  }
  return ['finance-admin@example.com']
}

function isAdminEmail(email: string | null): boolean {
  if (!email) {
    return false
  }
  const allowList = parseAdminEmails()
  return allowList.includes(email.trim().toLowerCase())
}

function toFormRates(rates: Rates): FormRates {
  return MANAGED_CURRENCIES.reduce<FormRates>(
    (acc, code) => {
      const value = rates[code]
      acc[code] = typeof value === 'number' && value > 0 ? String(value) : ''
      return acc
    },
    { USD: '', EUR: '', GBP: '', JPY: '', KRW: '' },
  )
}

export function FxRatesAdmin({
  userEmail,
  rates,
  active,
  effectiveDate,
  source,
}: FxRatesAdminProps) {
  const { t } = useTranslation()
  const [formRates, setFormRates] = useState<FormRates>(() => toFormRates(rates))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const adminAllowed = useMemo(() => isAdminEmail(userEmail), [userEmail])

  useEffect(() => {
    setFormRates(toFormRates(rates))
  }, [rates])

  if (!adminAllowed) {
    return null
  }

  const handleChange = (code: CurrencyCode, value: string) => {
    setFormRates((prev) => ({
      ...prev,
      [code]: value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    setError(null)

    const payload: Partial<Record<CurrencyCode, number>> = {}
    for (const code of MANAGED_CURRENCIES) {
      const raw = formRates[code].trim()
      if (!raw) {
        continue
      }
      const numeric = Number(raw)
      if (!Number.isFinite(numeric) || numeric <= 0) {
        setError(`Invalid rate for ${code}`)
        setSaving(false)
        return
      }
      payload[code] = numeric
    }

    try {
      const result = await setFxRates({ rates: payload, source: 'manual' })
      const { date, source: savedSource } = result.data ?? {}
      setStatus(`Saved manual rates for ${date ?? '(unknown date)'} (${savedSource ?? 'manual'})`)
    } catch (cause) {
      console.error('Failed to save FX rates', cause)
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-100">
          {t('settings.preferences.fxRatesAdmin.title', 'FX Rates · Admin')}
        </h2>
        <p className="text-sm text-slate-400">
          {t(
            'settings.preferences.fxRatesAdmin.subtitle',
            'Manually seed exchange rates when the automated feed is unavailable.',
          )}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {MANAGED_CURRENCIES.map((code) => (
          <label key={code} className="space-y-1 text-sm">
            <span className="font-medium text-slate-300">{code}</span>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={formRates[code]}
              onChange={(event) => handleChange(code, event.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              placeholder="0.031"
            />
          </label>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        {t(
          'settings.preferences.fxRatesAdmin.hint',
          'All values are quoted as target currency per 1 TWD.',
        )}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span>
          {t('settings.preferences.fxRatesAdmin.currentDate', 'Effective date')}:&nbsp;
          {effectiveDate ?? '(unknown)'}
        </span>
        <span>
          {t('settings.preferences.fxRatesAdmin.currentSource', 'Source')}:&nbsp;
          {source ?? '(unknown)'}
        </span>
        <span>
          {t('settings.preferences.fxRatesAdmin.active', 'Active')}:{' '}
          {active ? t('settings.preferences.fxRatesAdmin.activeYes', 'yes') : 'no'}
        </span>
      </div>

      {status && (
        <p className="rounded border border-emerald-500/60 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          {status}
        </p>
      )}
      {error && (
        <p className="rounded border border-red-500/60 bg-red-500/10 p-3 text-xs text-red-200">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setFormRates(toFormRates(rates))
          }}
          className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          disabled={saving}
        >
          {t('settings.preferences.fxRatesAdmin.reset', 'Reset')}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleSave()
          }}
          className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
          disabled={saving}
        >
          {saving
            ? t('settings.preferences.fxRatesAdmin.saving', 'Saving…')
            : t('settings.preferences.fxRatesAdmin.save', 'Save')}
        </button>
      </div>
    </section>
  )
}

export default FxRatesAdmin
