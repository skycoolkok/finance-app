import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { currency, date } from '../lib/fmt'
import type { CardSummary as CardSummaryType } from '../hooks/useCardSummaries'

type CardSummaryProps = {
  summary: CardSummaryType
}

export function CardSummary({ summary }: CardSummaryProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage || i18n.language

  const {
    card,
    currentDue,
    nextEstimate,
    utilization,
    dueDateISO,
    daysToDue,
    cycleStartISO,
    cycleEndISO,
  } = summary

  const utilizationPct = Math.min(utilization * 100, 999)
  const utilizationClass = getUtilizationClass(utilizationPct)
  const dueBadgeClass = getDueBadgeClass(daysToDue)
  const dueLabel = getDueLabelText(daysToDue, t)

  return (
    <article className="space-y-3 rounded border border-slate-800 bg-slate-950/60 p-4 shadow">
      <header className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-slate-100">{card.alias || card.issuer}</h4>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {card.issuer} · **** {card.last4}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${utilizationClass}`}>
          {t('cards.summary.utilization', { percentage: utilizationPct.toFixed(0) })}
        </span>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-slate-400">{t('cards.summary.currentDue')}</dt>
          <dd className="text-xl font-semibold text-slate-100">{currency(currentDue, locale)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-400">{t('cards.summary.nextEstimate')}</dt>
          <dd className="text-xl font-semibold text-slate-100">{currency(nextEstimate, locale)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-400">{t('cards.summary.billingCycle')}</dt>
          <dd className="text-sm text-slate-200">
            {date(cycleStartISO, locale)} - {date(cycleEndISO, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-400">{t('cards.summary.dueDate')}</dt>
          <dd className="flex items-center gap-2 text-sm text-slate-200">
            <span>{date(dueDateISO, locale)}</span>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${dueBadgeClass}`}>
              {dueLabel}
            </span>
          </dd>
        </div>
      </dl>
    </article>
  )
}

function getUtilizationClass(utilizationPct: number) {
  if (utilizationPct >= 95) {
    return 'bg-red-500/20 text-red-400'
  }
  if (utilizationPct >= 80) {
    return 'bg-amber-500/20 text-amber-400'
  }
  return 'bg-emerald-500/20 text-emerald-400'
}

function getDueBadgeClass(daysToDue: number) {
  if (daysToDue <= 0) {
    return 'bg-red-500/20 text-red-400'
  }
  if (daysToDue <= 1) {
    return 'bg-red-500/20 text-red-300'
  }
  if (daysToDue <= 3) {
    return 'bg-amber-500/20 text-amber-400'
  }
  if (daysToDue <= 7) {
    return 'bg-yellow-500/20 text-yellow-400'
  }
  return 'bg-slate-700/40 text-slate-200'
}

function getDueLabelText(daysToDue: number, t: TFunction<'common'>) {
  if (daysToDue < 0) {
    return t('cards.summary.dueLabel.overdue', { count: Math.abs(daysToDue) })
  }
  if (daysToDue === 0) {
    return t('cards.summary.dueLabel.dueToday')
  }
  if (daysToDue === 1) {
    return t('cards.summary.dueLabel.dueTomorrow')
  }
  return t('cards.summary.dueLabel.days', { count: daysToDue })
}
