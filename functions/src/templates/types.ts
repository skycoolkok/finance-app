export type NotificationContent = {
  summary: string
  push: {
    title: string
    body: string
  }
  email: {
    subject: string
    templateName: 'email'
    context: Record<string, unknown>
  }
  url: string
}

export type DueReminderInput = {
  cardLabel: string
  daysToDue: number
  dueDate: Date
  amount: number
  baseUrl: string
}

export type UtilizationAlertInput = {
  cardLabel: string
  utilization: number
  threshold: number
  limit: number
  amount: number
  baseUrl: string
}

export type BudgetAlertInput = {
  budgetLabel: string
  spent: number
  limit: number
  percentage: number
  threshold: number
  baseUrl: string
}

export type NotificationTemplates = {
  dueReminder: (input: DueReminderInput) => NotificationContent
  utilizationAlert: (input: UtilizationAlertInput) => NotificationContent
  budgetAlert: (input: BudgetAlertInput) => NotificationContent
}
