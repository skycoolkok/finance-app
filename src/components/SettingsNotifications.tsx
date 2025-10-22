import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

type SettingsNotificationsProps = {
  userId: string | null
}

export function SettingsNotifications({ userId }: SettingsNotificationsProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState<'push' | 'email' | null>(null)

  const disabled = !userId || isSending !== null

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
      </div>

      {!userId && (
        <p className="text-xs text-slate-400">{t('notifications.settings.messages.noAccess')}</p>
      )}
    </section>
  )
}

export default SettingsNotifications
