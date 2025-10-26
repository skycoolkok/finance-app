import type { NotificationEngine, ReminderEvent } from './engine'

export type BudgetAlertConfig = {
  userId: string
  budgetId: string
  budgetLabel: string
  spent: number
  limit: number
  threshold: number
}

export async function sendBudgetAlert(
  engine: NotificationEngine,
  config: BudgetAlertConfig,
): Promise<void> {
  const percentage =
    config.limit > 0 && Number.isFinite(config.limit) ? config.spent / config.limit : 0

  const reminder: ReminderEvent = {
    userId: config.userId,
    type: `budget-${config.threshold}`,
    eventKey: `budget:${config.budgetId}:usage:${config.threshold}`,
    budgetId: config.budgetId,
    template: {
      kind: 'budget',
      data: {
        budgetLabel: config.budgetLabel,
        spent: config.spent,
        limit: config.limit,
        percentage,
        threshold: config.threshold,
      },
    },
  }

  await engine.deliverReminder(reminder)
}
