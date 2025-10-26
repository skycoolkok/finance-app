import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'

import { auth, functions } from '../firebase'
import { setUserLocale } from '../functions'
import { useCurrency, setCurrency } from '../lib/currency'
import { normalizeLanguageTag } from '../lib/language'
import { useLocale } from '../lib/locale'

type SettingsNotificationsProps = {
  userId: string | null
}

export function SettingsNotifications({ userId }: SettingsNotificationsProps) {
  const { t, i18n } = useTranslation()
  const currencyCode = useCurrency()
  const currentLocale = useLocale()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState<'push' | 'email' | null>(null)
  const [isSyncingLocale, setIsSyncingLocale] = useState(false)

  const disabled = !userId || isSending !== null || isSyncingLocale

  const handleSend = async (mode: 'push' | 'email') => {
    if (!userId) {
      setError(t('notifications.settings.messages.missingUser'))
      return
    }

    setIsSending(mode)
    setError(null)
    setStatus(null)

    try {
      if (mode === 'push') {
        const callable = httpsCallable<
          { userId: string },
          { successCount: number; failureCount: number }
        >(functions, 'sendTestPush')
        const result = await callable({ userId })
        setStatus(
          t('notifications.settings.messages.pushSuccess', {
            count: result.data.successCount,
          }),
        )
      } else {
        const callable = httpsCallable<{ userId: string }, { delivered: boolean }>(
          functions,
          'sendTestEmail',
        )
        await callable({ userId })
        setStatus(t('notifications.settings.messages.emailSuccess'))
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : String(sendError))
    } finally {
      setIsSending(null)
    }
  }

  const handleSyncLocale = async () => {
    if (!userId) {
      setError(t('notifications.settings.messages.missingUser'))
      return
    }

    if (!auth.currentUser) {
      setError(t('notifications.settings.messages.localeAuthRequired'))
      return
    }

    const locale = normalizeLanguageTag(i18n.resolvedLanguage || i18n.language)
    setIsSyncingLocale(true)
    setError(null)
    setStatus(null)

    try {
      await setUserLocale({ locale })
      setStatus(t('notifications.settings.messages.localeSuccess', { locale }))
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : String(syncError))
    } finally {
      setIsSyncingLocale(false)
    }
  }

  const handleCurrencyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCurrency = event.target.value
    setCurrency(nextCurrency)
    setError(null)
    const currencyLabel = t(`notifications.settings.currency.options.${nextCurrency}` as const)
    setStatus(t('notifications.settings.currency.updated', { currency: currencyLabel }))
  }

  const handleLanguageChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = normalizeLanguageTag(event.target.value)
    setError(null)
    setStatus(null)

    try {
      await i18n.changeLanguage(nextLocale)
      const label = t(
        `notifications.settings.language.options.${nextLocale.replace('-', '')}` as const,
      )
      setStatus(t('notifications.settings.language.updated', { locale: label }))
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : String(changeError))
    }
  }

  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header>
        <h2 className="text-xl font-semibold text-slate-100">
          {t('notifications.settings.title')}
        </h2>
        <p className="text-sm text-slate-500">{t('notifications.settings.subtitle')}</p>
      </header>

      {status && (
        <p className="rounded border border-emerald-500/60 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {status}
        </p>
      )}
      {error && (
        <p className="rounded border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="space-y-2 rounded border border-slate-800 bg-slate-950/60 p-4">
        <label htmlFor="language-select" className="text-sm font-medium text-slate-200">
          {t('notifications.settings.language.label')}
        </label>
        <select
          id="language-select"
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          value={currentLocale}
          onChange={(event) => {
            void handleLanguageChange(event)
          }}
        >
          <option value="en">{t('notifications.settings.language.options.en')}</option>
          <option value="zh-TW">{t('notifications.settings.language.options.zhTW')}</option>
        </select>
        <p className="text-xs text-slate-500">{t('notifications.settings.language.description')}</p>
      </div>

      <div className="space-y-2 rounded border border-slate-800 bg-slate-950/60 p-4">
        <label htmlFor="currency-select" className="text-sm font-medium text-slate-200">
          {t('notifications.settings.currency.label')}
        </label>
        <select
          id="currency-select"
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          value={currencyCode}
          onChange={handleCurrencyChange}
        >
          <option value="USD">{t('notifications.settings.currency.options.USD')}</option>
          <option value="TWD">{t('notifications.settings.currency.options.TWD')}</option>
        </select>
        <p className="text-xs text-slate-500">{t('notifications.settings.currency.description')}</p>
      </div>

      <p className="text-xs text-slate-500">
        {t('notifications.settings.status.localeCurrency', {
          locale: currentLocale,
          currency: currencyCode,
        })}
      </p>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            void handleSend('push')
          }}
          disabled={disabled}
          className="w-full rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
        >
          {isSending === 'push'
            ? t('notifications.settings.sending.push')
            : t('notifications.settings.buttons.sendPush')}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleSend('email')
          }}
          disabled={disabled}
          className="w-full rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/40"
        >
          {isSending === 'email'
            ? t('notifications.settings.sending.email')
            : t('notifications.settings.buttons.sendEmail')}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleSyncLocale()
          }}
          disabled={disabled}
          className="w-full rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-700/40"
        >
          {isSyncingLocale
            ? t('notifications.settings.sending.locale')
            : t('notifications.settings.buttons.syncLocale')}
        </button>
      </div>

      {!userId && (
        <p className="text-xs text-slate-400">{t('notifications.settings.messages.noAccess')}</p>
      )}
    </section>
  )
}

export default SettingsNotifications
