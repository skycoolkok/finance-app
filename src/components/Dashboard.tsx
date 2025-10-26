import { useTranslation } from 'react-i18next'

import { useCardSummaries } from '../hooks/useCardSummaries'
import { formatMoney, useCurrency } from '../lib/currency'
import { CardSummary } from './CardSummary'

type DashboardProps = {
  userId: string | null
}

export function Dashboard({ userId }: DashboardProps) {
  const { t, i18n } = useTranslation()
  const { summaries, totals, loading } = useCardSummaries(userId)
  const locale = i18n.resolvedLanguage || i18n.language
  const currencyCode = useCurrency()

  return (
    <section className="space-y-5 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">{t('dashboard.title')}</h2>
          <p className="text-sm text-slate-400">{t('dashboard.subtitle')}</p>
        </div>
        <div className="rounded bg-slate-950/60 px-4 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {t('dashboard.totalCurrentDue')}
          </p>
          <p className="text-lg font-semibold text-emerald-400">
            {formatMoney(totals.currentDue, { locale, currency: currencyCode })}
          </p>
          <p className="text-xs text-slate-500">
            {t('dashboard.nextEstimate', {
              amount: formatMoney(totals.nextEstimate, { locale, currency: currencyCode }),
            })}
          </p>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">{t('dashboard.loading')}</p>
      ) : summaries.length === 0 ? (
        <p className="text-sm text-slate-500">{t('dashboard.empty')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {summaries.map((summary) => (
            <CardSummary key={summary.card.id} summary={summary} />
          ))}
        </div>
      )}
    </section>
  )
}
