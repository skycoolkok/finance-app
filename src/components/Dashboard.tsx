import { useTranslation } from 'react-i18next'

import { useCardSummaries } from '../hooks/useCardSummaries'
import { normalizeLanguageTag } from '../lib/language'
import { formatCurrency, type CurrencyCode, type Rates } from '../lib/money'
import { CardSummary } from './CardSummary'

type DashboardProps = {
  userId: string | null
  preferredCurrency: CurrencyCode
  currencyLoading: boolean
  rates: Rates
}

export function Dashboard({ userId, preferredCurrency, currencyLoading, rates }: DashboardProps) {
  const { t, i18n } = useTranslation()
  const { summaries, totals, loading } = useCardSummaries(userId)
  const locale = normalizeLanguageTag(i18n.resolvedLanguage || i18n.language)
  const isDev = import.meta.env.DEV

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
            {formatCurrency(totals.currentDue, { currency: preferredCurrency, lng: locale, rates })}
          </p>
          <p className="text-xs text-slate-500">
            {t('dashboard.nextEstimate', {
              amount: formatCurrency(totals.nextEstimate, {
                currency: preferredCurrency,
                lng: locale,
                rates,
              }),
            })}
          </p>
          {isDev && (
            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-600">
              {currencyLoading
                ? t('dashboard.currencyLoading')
                : t('dashboard.currencyBadge', { currency: preferredCurrency })}
            </p>
          )}
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">{t('dashboard.loading')}</p>
      ) : summaries.length === 0 ? (
        <p className="text-sm text-slate-500">{t('dashboard.empty')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {summaries.map((summary) => (
            <CardSummary
              key={summary.card.id}
              summary={summary}
              preferredCurrency={preferredCurrency}
              rates={rates}
            />
          ))}
        </div>
      )}
    </section>
  )
}
