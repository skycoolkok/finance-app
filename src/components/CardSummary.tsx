import type { CardSummary as CardSummaryType } from '../hooks/useCardSummaries'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
})

type CardSummaryProps = {
  summary: CardSummaryType
}

export function CardSummary({ summary }: CardSummaryProps) {
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
  const dueLabel = getDueLabel(daysToDue)

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
          Utilization {utilizationPct.toFixed(0)}%
        </span>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-slate-400">Current Due</dt>
          <dd className="text-xl font-semibold text-slate-100">
            {currencyFormatter.format(currentDue)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-400">Next Estimate</dt>
          <dd className="text-xl font-semibold text-slate-100">
            {currencyFormatter.format(nextEstimate)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-400">Billing Cycle</dt>
          <dd className="text-sm text-slate-200">{formatRange(cycleStartISO, cycleEndISO)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-400">Due Date</dt>
          <dd className="flex items-center gap-2 text-sm text-slate-200">
            <span>{formatDate(dueDateISO)}</span>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${dueBadgeClass}`}>
              {dueLabel}
            </span>
          </dd>
        </div>
      </dl>
    </article>
  )
}

function formatRange(startISO: string, endISO: string) {
  const start = new Date(startISO)
  const end = new Date(endISO)
  return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`
}

function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso))
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

function getDueLabel(daysToDue: number) {
  if (daysToDue < 0) {
    return `${Math.abs(daysToDue)}d overdue`
  }
  if (daysToDue === 0) {
    return 'Due today'
  }
  if (daysToDue === 1) {
    return 'Due tomorrow'
  }
  return `${daysToDue} days`
}
