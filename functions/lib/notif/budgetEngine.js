'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.sendBudgetAlert = sendBudgetAlert
async function sendBudgetAlert(engine, config) {
  const percentage =
    config.limit > 0 && Number.isFinite(config.limit) ? config.spent / config.limit : 0
  const reminder = {
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
