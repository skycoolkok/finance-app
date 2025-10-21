import type { BudgetWithUsage } from '../hooks/useBudgets'
import { topBudgetCategories } from '../hooks/useBudgets'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

type BudgetOverviewProps = {
  budgets: BudgetWithUsage[]
  loading?: boolean
  onManageBudgets?: () => void
}

function parseDate(value: string) {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isActiveBudget(budget: BudgetWithUsage, reference: Date) {
  const start = parseDate(budget.startDate)
  const end = parseDate(budget.endDate)
  if (start && start > reference) {
    return false
  }
  if (end && end < reference) {
    return false
  }
  return true
}

export function BudgetOverview({ budgets, loading, onManageBudgets }: BudgetOverviewProps) {
  const referenceDate = new Date()
  const activeBudgets = budgets.filter(budget => isActiveBudget(budget, referenceDate))
  const topBudgets = topBudgetCategories(activeBudgets, 3)

  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header>
        <h2 className="text-xl font-semibold text-slate-100">Budget Overview</h2>
        <p className="text-sm text-slate-500">
          Track your top spending categories and stay ahead of overspending.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Loading budget insights...</p>
      ) : activeBudgets.length === 0 ? (
        <p className="text-sm text-slate-500">
          No budgets to display yet. Add a budget to start tracking spend.
        </p>
      ) : (
        <ul className="space-y-3">
          {topBudgets.map(budget => {
            const percent = Math.min(Math.round(budget.usage * 100), 999)
            const spentLabel = currencyFormatter.format(budget.computedSpent)
            const limitLabel = currencyFormatter.format(budget.limit)
            let badgeClasses = 'text-slate-200 bg-slate-700/30'
            let barClasses = 'bg-slate-600'

            if (budget.isOverLimit) {
              badgeClasses = 'text-red-400 bg-red-500/15'
              barClasses = 'bg-red-500'
            } else if (budget.isWarning) {
              badgeClasses = 'text-amber-400 bg-amber-500/15'
              barClasses = 'bg-amber-500'
            }

            return (
              <li
                key={budget.id}
                className="rounded border border-slate-800 bg-slate-950/60 p-4 text-sm shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-100">
                      {budget.category || 'Uncategorized'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {spentLabel} / {limitLabel}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses}`}>
                    {percent}%
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-800">
                  <div
                    className={`h-2 rounded-full ${barClasses}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={onManageBudgets}
          className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800/60"
        >
          前往預算設定
        </button>
      </div>
    </section>
  )
}

export default BudgetOverview
