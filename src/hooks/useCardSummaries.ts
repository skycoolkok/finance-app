import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { Card, Transaction } from '../models/types'
import { computeCycle, computeDueDate, daysLeft } from '../utils/billing'

export type CardSummary = {
  card: Card
  currentDue: number
  nextEstimate: number
  utilization: number
  dueDateISO: string
  daysToDue: number
  cycleStartISO: string
  cycleEndISO: string
}

export type CardSummaryTotals = {
  currentDue: number
  nextEstimate: number
}

export function useCardSummaries(userId: string | null) {
  const [cards, setCards] = useState<Card[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setCards([])
      return
    }

    const cardsQuery = query(
      collection(db, 'cards'),
      where('userId', '==', userId),
      orderBy('alias'),
    )

    const unsubscribe = onSnapshot(cardsQuery, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Card,
      )
      setCards(data)
    })

    return () => unsubscribe()
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setTransactions([])
      setLoading(false)
      return
    }

    setLoading(true)

    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
    )

    const unsubscribe = onSnapshot(txQuery, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Transaction,
      )
      setTransactions(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [userId])

  const { summaries, totals } = useMemo(() => {
    if (cards.length === 0) {
      return { summaries: [], totals: { currentDue: 0, nextEstimate: 0 } }
    }

    const today = new Date()

    const summaries = cards.map((card) => {
      const cycle = computeCycle(today, card.statementDay)
      const nextCycleAnchor = new Date(cycle.end)
      nextCycleAnchor.setDate(nextCycleAnchor.getDate() + 1)
      const nextCycle = computeCycle(nextCycleAnchor, card.statementDay)
      const dueDate = computeDueDate(cycle.end, card.dueDay)

      const currentDue = sumTransactionsInRange(transactions, card.id, cycle.start, cycle.end)
      const nextEstimate = sumTransactionsInRange(
        transactions,
        card.id,
        nextCycle.start,
        nextCycle.end,
      )

      const utilization = card.limitAmount > 0 ? currentDue / card.limitAmount : 0
      const dueDateISO = toISODate(dueDate)
      const cycleStartISO = toISODate(cycle.start)
      const cycleEndISO = toISODate(cycle.end)
      const daysToDue = daysLeft(today, dueDate)

      return {
        card,
        currentDue,
        nextEstimate,
        utilization,
        dueDateISO,
        daysToDue,
        cycleStartISO,
        cycleEndISO,
      }
    })

    const totals = summaries.reduce<CardSummaryTotals>(
      (acc, summary) => {
        acc.currentDue += summary.currentDue
        acc.nextEstimate += summary.nextEstimate
        return acc
      },
      { currentDue: 0, nextEstimate: 0 },
    )

    return { summaries, totals }
  }, [cards, transactions])

  return {
    summaries,
    totals,
    loading,
  }
}

function sumTransactionsInRange(
  transactions: Transaction[],
  cardId: string,
  start: Date,
  end: Date,
) {
  return transactions.reduce((total, tx) => {
    if (!tx.affectCurrentBill) {
      return total
    }

    if (tx.cardId !== cardId) {
      return total
    }

    const txDate = new Date(tx.date)
    if (Number.isNaN(txDate.getTime())) {
      return total
    }

    if (txDate < start || txDate > end) {
      return total
    }

    return total + tx.amount
  }, 0)
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}
