import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Budget, Transaction } from '../models/types'

export type BudgetWithUsage = Budget & {
  computedSpent: number
  usage: number
  remaining: number
  isWarning: boolean
  isOverLimit: boolean
}

type HookState = {
  budgets: BudgetWithUsage[]
  loading: boolean
  error: string | null
}

type FirestoreBudgetDocument = {
  userId?: string
  category?: string
  limit?: number
  period?: string
  startDate?: string | { toDate?: () => Date }
  endDate?: string | { toDate?: () => Date }
  spent?: number
}

type FirestoreTransactionDocument = {
  userId?: string
  date?: string | { toDate?: () => Date }
  amount?: number
  category?: string
}

const currencyCategoriesComparator = (a: BudgetWithUsage, b: BudgetWithUsage) =>
  b.computedSpent - a.computedSpent

const startDateComparator = (a: BudgetWithUsage, b: BudgetWithUsage) => {
  const dateA = Date.parse(a.startDate)
  const dateB = Date.parse(b.startDate)
  if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
    return 0
  }
  if (Number.isNaN(dateA)) {
    return 1
  }
  if (Number.isNaN(dateB)) {
    return -1
  }
  return dateB - dateA
}

function parseDateValue(value: unknown): Date | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return null
}

function normalizeDateInput(value: unknown): string {
  const parsed = parseDateValue(value)
  if (!parsed) {
    return ''
  }
  return parsed.toISOString().split('T')[0]
}

function sanitizeCategory(value: string | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function mapBudgetDoc(doc: QueryDocumentSnapshot<DocumentData>): Budget {
  const data = doc.data() as FirestoreBudgetDocument

  return {
    id: doc.id,
    userId: data.userId ?? '',
    category: data.category ?? '',
    limit: typeof data.limit === 'number' ? data.limit : 0,
    period: data.period ?? 'custom',
    startDate: normalizeDateInput(data.startDate),
    endDate: normalizeDateInput(data.endDate),
    spent: typeof data.spent === 'number' ? data.spent : 0,
  }
}

function mapTransactionDoc(doc: QueryDocumentSnapshot<DocumentData>): Transaction {
  const data = doc.data() as FirestoreTransactionDocument

  return {
    id: doc.id,
    userId: data.userId ?? '',
    date: normalizeDateInput(data.date),
    amount: typeof data.amount === 'number' ? data.amount : 0,
    merchant: '',
    category: data.category ?? '',
    sourceType: 'card',
    sourceId: '',
    affectCurrentBill: true,
    cardId: null,
    note: undefined,
  }
}

export function useBudgets(userId: string | null): HookState {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [budgetsLoaded, setBudgetsLoaded] = useState(false)
  const [transactionsLoaded, setTransactionsLoaded] = useState(false)

  useEffect(() => {
    if (!userId) {
      setBudgets([])
      setTransactions([])
      setBudgetsLoaded(true)
      setTransactionsLoaded(true)
      return
    }

    setBudgetsLoaded(false)
    setTransactionsLoaded(false)

    const budgetsQuery = query(
      collection(db, 'budgets'),
      where('userId', '==', userId),
      orderBy('startDate', 'desc'),
    )

    const unsubscribeBudgets = onSnapshot(
      budgetsQuery,
      snapshot => {
        setBudgets(snapshot.docs.map(mapBudgetDoc))
        setBudgetsLoaded(true)
      },
      err => {
        setError(err.message)
        setBudgets([])
        setBudgetsLoaded(true)
      },
    )

    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
    )

    const unsubscribeTransactions = onSnapshot(
      transactionsQuery,
      snapshot => {
        setTransactions(snapshot.docs.map(mapTransactionDoc))
        setTransactionsLoaded(true)
      },
      err => {
        setError(err.message)
        setTransactions([])
        setTransactionsLoaded(true)
      },
    )

    return () => {
      unsubscribeBudgets()
      unsubscribeTransactions()
    }
  }, [userId])

  const budgetsWithUsage = useMemo<BudgetWithUsage[]>(() => {
    if (!budgets.length) {
      return []
    }

    return budgets
      .map(budget => {
        const normalizedCategory = sanitizeCategory(budget.category)
        const startDate = parseDateValue(budget.startDate)
        const endDate = parseDateValue(budget.endDate)

        const spentFromTransactions = transactions.reduce((total, transaction) => {
          if (sanitizeCategory(transaction.category) !== normalizedCategory) {
            return total
          }

          const transactionDate = parseDateValue(transaction.date)
          if (transactionDate && startDate && transactionDate < startDate) {
            return total
          }
          if (transactionDate && endDate && transactionDate > endDate) {
            return total
          }

          return total + Math.max(transaction.amount, 0)
        }, 0)

        const computedSpent = Math.max(spentFromTransactions, budget.spent ?? 0)
        const usage = budget.limit > 0 ? computedSpent / budget.limit : 0
        const normalizedUsage = Number.isFinite(usage) ? usage : 0
        const remaining = budget.limit - computedSpent

        return {
          ...budget,
          computedSpent,
          usage: normalizedUsage,
          remaining,
          isWarning: normalizedUsage >= 0.8 && normalizedUsage < 1,
          isOverLimit: normalizedUsage >= 1,
        }
      })
      .sort(startDateComparator)
  }, [budgets, transactions])

  return {
    budgets: budgetsWithUsage,
    loading: !budgetsLoaded || !transactionsLoaded,
    error,
  }
}

export function topBudgetCategories(budgets: BudgetWithUsage[], limit = 3) {
  return [...budgets].sort(currencyCategoriesComparator).slice(0, limit)
}
