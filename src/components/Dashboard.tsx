import { CardSummary } from './CardSummary'
import { useCardSummaries } from '../hooks/useCardSummaries'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

type DashboardProps = {
  userId: string | null
}

export function Dashboard({ userId }: DashboardProps) {
  const { summaries, totals, loading } = useCardSummaries(userId)

  return (
    <section className="space-y-5 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Billing Dashboard</h2>
          <p className="text-sm text-slate-400">
            Track statement cycles, utilization, and upcoming due dates across your cards.
          </p>
        </div>
        <div className="rounded bg-slate-950/60 px-4 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Current Due</p>
          <p className="text-lg font-semibold text-emerald-400">
            {currencyFormatter.format(totals.currentDue)}
          </p>
          <p className="text-xs text-slate-500">
            Next Estimate {currencyFormatter.format(totals.nextEstimate)}
          </p>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Loading billing data…</p>
      ) : summaries.length === 0 ? (
        <p className="text-sm text-slate-500">Add a card to see billing insights.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {summaries.map(summary => (
            <CardSummary key={summary.card.id} summary={summary} />
          ))}
        </div>
      )}
    </section>
  )
}
