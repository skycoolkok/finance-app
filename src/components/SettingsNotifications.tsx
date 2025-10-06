import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

type SettingsNotificationsProps = {
  userId: string | null
}

export function SettingsNotifications({ userId }: SettingsNotificationsProps) {
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState<'push' | 'email' | null>(null)

  const disabled = !userId || isSending !== null

  const handleSend = async (mode: 'push' | 'email') => {
    if (!userId) {
      setError('Sign in to send test notifications.')
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
        setStatus(`Push delivered to ${result.data.successCount} device(s).`)
      } else {
        const callable = httpsCallable<{ userId: string }, { delivered: boolean }>(
          functions,
          'sendTestEmail',
        )
        await callable({ userId })
        setStatus('Test email sent via Resend.')
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
        <h2 className="text-xl font-semibold text-slate-100">Notification Settings</h2>
        <p className="text-sm text-slate-500">
          Trigger test notifications to verify device tokens and email configuration.
        </p>
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
          {isSending === 'push' ? 'Sending push...' : 'Send Test Push'}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleSend('email')
          }}
          disabled={disabled}
          className="w-full rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/40"
        >
          {isSending === 'email' ? 'Sending email...' : 'Send Test Email'}
        </button>
      </div>

      {!userId && <p className="text-xs text-slate-400">Sign in to access notification tools.</p>}
    </section>
  )
}

export default SettingsNotifications
