import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { CurrencyCode, Rates } from '../lib/money'
import { checkFxAdmin, setFxRates } from '../functions'

type SettingsFxAdminProps = {
  userEmail: string | null
  rates: Rates
  active: boolean
  effectiveDate: string | null
  source: string | null
  updatedAt: string | null
  loading: boolean
}

type ManagedCurrency = (typeof MANAGED_CURRENCIES)[number]
type FormRates = Record<ManagedCurrency, string>

const MANAGED_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'JPY', 'KRW']
const EMPTY_FORM: FormRates = { USD: '', EUR: '', GBP: '', JPY: '', KRW: '' }

function toFormRates(rates: Rates): FormRates {
  return MANAGED_CURRENCIES.reduce<FormRates>((acc, code) => {
    const value = rates[code]
    acc[code] = typeof value === 'number' && value > 0 ? String(value) : ''
    return acc
  }, { ...EMPTY_FORM })
}

function parseRates(formRates: FormRates): Partial<Record<CurrencyCode, number>> {
  const payload: Partial<Record<CurrencyCode, number>> = {}

  for (const code of MANAGED_CURRENCIES) {
    const raw = formRates[code].trim()
    if (!raw) {
      continue
    }
    const numeric = Number(raw)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error(`Invalid rate for ${code}`)
    }
    payload[code] = numeric
  }

  return payload
}

function formatUpdatedAt(updatedAt: string | null, locale: string): string {
  if (!updatedAt) {
    return '(unknown)'
  }

  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) {
    return updatedAt
  }

  return date.toLocaleString(locale)
}

export function SettingsFxAdmin({
  userEmail,
  rates,
  active,
  effectiveDate,
  source,
  updatedAt,
  loading,
}: SettingsFxAdminProps) {
  const { t, i18n } = useTranslation()
  const [formRates, setFormRates] = useState<FormRates>(() => toFormRates(rates))
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [adminState, setAdminState] = useState<'loading' | 'allowed' | 'denied'>(
    userEmail ? 'loading' : 'denied',
  )

  const locale = i18n.resolvedLanguage || i18n.language || 'en'

  useEffect(() => {
    setFormRates(toFormRates(rates))
  }, [rates])

  useEffect(() => {
    if (!toastMessage) {
      return
    }
    if (typeof window === 'undefined') {
      return
    }
    const timer = window.setTimeout(() => {
      setToastMessage(null)
    }, 3000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [toastMessage])

  useEffect(() => {
    if (!userEmail) {
      setAdminState('denied')
      return
    }

    let alive = true
    setAdminState('loading')
    void checkFxAdmin({ email: userEmail })
      .then((result) => {
        if (!alive) {
          return
        }
        const allowed = result.data?.allowed ?? false
        setAdminState(allowed ? 'allowed' : 'denied')
      })
      .catch(() => {
        if (!alive) {
          return
        }
        setAdminState('denied')
      })

    return () => {
      alive = false
    }
  }, [userEmail])

  if (adminState !== 'allowed') {
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
    setErrorMessage(null)
    setToastMessage(null)

    let payload: Partial<Record<CurrencyCode, number>>
    try {
      payload = parseRates(formRates)
      if (Object.keys(payload).length === 0) {
        throw new Error('Provide at least one rate')
      }
    } catch (cause) {
      setSaving(false)
      setErrorMessage(cause instanceof Error ? cause.message : String(cause))
      return
    }

    try {
      const result = await setFxRates({ rates: payload, source: 'manual' })
      const savedDate = result.data?.date ?? effectiveDate ?? '(unknown)'
      setToastMessage(
        t('settings.preferences.fxRatesAdmin.toastSaved', 'Manual FX rates saved for {{date}}', {
          date: savedDate,
        }),
      )
    } catch (cause) {
      console.error('Failed to save FX rates', cause)
      setErrorMessage(
        cause instanceof Error
          ? cause.message
          : t('settings.preferences.fxRatesAdmin.errorGeneric', 'Failed to save rates'),
      )
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

      <div className="space-y-2 text-xs text-slate-400">
        <p>
          {t('settings.preferences.fxRatesAdmin.currentDate', 'Effective date')}:&nbsp;
          {effectiveDate ?? '(unknown)'}
        </p>
        <p>
          {t('settings.preferences.fxRatesAdmin.currentSource', 'Source')}:&nbsp;
          {source ?? '(unknown)'}
        </p>
        <p>
          {t('settings.preferences.fxRatesAdmin.updatedAt', 'Last updated')}:&nbsp;
          {formatUpdatedAt(updatedAt, locale)}
        </p>
        <p>
          {t('settings.preferences.fxRatesAdmin.active', 'Active')}:{' '}
          {active ? t('settings.preferences.fxRatesAdmin.activeYes', 'yes') : 'no'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MANAGED_CURRENCIES.map((code) => (
          <label key={code} className="space-y-1 text-sm">
            <span className="font-medium text-slate-300">{code}</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0"
              value={formRates[code]}
              onChange={(event) => handleChange(code, event.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              placeholder="0.031"
              disabled={saving || loading}
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

      {errorMessage && (
        <p className="rounded border border-red-500/60 bg-red-500/10 p-3 text-xs text-red-200">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setFormRates(toFormRates(rates))
            setErrorMessage(null)
          }}
          className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          disabled={saving || loading}
        >
          {t('settings.preferences.fxRatesAdmin.reset', 'Reset')}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleSave()
          }}
          className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
          disabled={saving || loading}
        >
          {saving
            ? t('settings.preferences.fxRatesAdmin.saving', 'Saving...')
            : t('settings.preferences.fxRatesAdmin.save', 'Save')}
        </button>
      </div>

      {toastMessage && (
        <p className="rounded border border-emerald-500/60 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          {toastMessage}
        </p>
      )}
    </section>
  )
}

export default SettingsFxAdmin

