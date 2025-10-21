import type { BudgetWithUsage } from '../hooks/useBudgets'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

type BudgetListProps = {
  budgets: BudgetWithUsage[]
  loading?: boolean
  onEdit?: (budget: BudgetWithUsage) => void
}

export function BudgetList({ budgets, loading, onEdit }: BudgetListProps) {
  if (loading) {
    return (
      <div className="rounded border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
        Loading budgets...
      </div>
    )
  }

  if (budgets.length === 0) {
    return (
      <div className="rounded border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
        No budgets created yet. Add a budget to start tracking your spending.
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {budgets.map(budget => {
        const progress = Math.min(budget.usage * 100, 100)
        let progressColor = 'bg-emerald-500'
        if (budget.isOverLimit) {
          progressColor = 'bg-red-500'
        } else if (budget.isWarning) {
          progressColor = 'bg-amber-500'
        }

        const limitLabel = currencyFormatter.format(budget.limit)
        const spentLabel = currencyFormatter.format(budget.computedSpent)
        const remainingLabel = currencyFormatter.format(budget.remaining)

        return (
          <li
            key={budget.id}
            className="rounded border border-slate-800 bg-slate-950/60 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-100">
                  {budget.category || 'Uncategorized'}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {budget.period} • {budget.startDate || 'N/A'} → {budget.endDate || 'N/A'}
                </p>
              </div>
              <div className="text-right text-sm text-slate-400">
                <p>
                  Limit: <span className="text-slate-100">{limitLabel}</span>
                </p>
                <p>
                  Spent: <span className="text-slate-100">{spentLabel}</span>
                </p>
                <p>
                  Remaining:{' '}
                  <span className={budget.remaining < 0 ? 'text-red-400' : 'text-slate-100'}>
                    {remainingLabel}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-3 h-2 rounded-full bg-slate-800">
              <div
                className={`h-2 rounded-full ${progressColor}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{Math.round(progress)}% of budget used</span>
              <button
                type="button"
                className="rounded border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
                onClick={() => onEdit?.(budget)}
              >
                Edit
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default BudgetList
