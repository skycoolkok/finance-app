export type BillingCycle = {
  start: Date
  end: Date
}

export function computeCycle(todayInput: Date | string, statementDay: number): BillingCycle {
  if (statementDay < 1 || statementDay > 31) {
    throw new Error('statementDay must be between 1 and 31')
  }

  const today = normalizeDate(todayInput)

  const currentMonthStatement = new Date(today.getFullYear(), today.getMonth(), statementDay)
  const cycleEnd =
    today.getDate() <= statementDay
      ? currentMonthStatement
      : new Date(today.getFullYear(), today.getMonth() + 1, statementDay)

  const previousCycleEnd = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() - 1, statementDay)
  const cycleStart = new Date(previousCycleEnd)
  cycleStart.setDate(previousCycleEnd.getDate() + 1)

  return {
    start: cycleStart,
    end: cycleEnd,
  }
}

export function computeDueDate(cycleEndInput: Date | string, dueDay: number): Date {
  if (dueDay < 1 || dueDay > 31) {
    throw new Error('dueDay must be between 1 and 31')
  }

  const cycleEnd = normalizeDate(cycleEndInput)
  let dueDate = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), dueDay)

  if (dueDate <= cycleEnd) {
    dueDate = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, dueDay)
  }

  return dueDate
}

export function daysLeft(fromInput: Date | string, toInput: Date | string): number {
  const from = normalizeDate(fromInput)
  const to = normalizeDate(toInput)
  const diffMs = to.getTime() - from.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function normalizeDate(value: Date | string): Date {
  if (value instanceof Date) {
    return stripTime(value)
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value')
  }
  return stripTime(date)
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
