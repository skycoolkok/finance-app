import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { Card, Transaction, Wallet } from '../models/types'

type TransactionListProps = {
  userId: string | null
  onTransactionsChange?: (transactions: Transaction[]) => void
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
})

export default function TransactionList({ userId, onTransactionsChange }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cardsById, setCardsById] = useState<Record<string, Card>>({})
  const [walletsById, setWalletsById] = useState<Record<string, Wallet>>({})

  useEffect(() => {
    if (!userId) {
      setCardsById({})
      return
    }

    const cardsQuery = query(
      collection(db, 'cards'),
      where('userId', '==', userId),
      orderBy('alias'),
    )

    const unsubscribe = onSnapshot(cardsQuery, snapshot => {
      const data = snapshot.docs.map(
        doc =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Card,
      )
      setCardsById(
        data.reduce<Record<string, Card>>((acc, card) => {
          acc[card.id] = card
          return acc
        }, {}),
      )
    })

    return () => unsubscribe()
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setWalletsById({})
      return
    }

    const walletsQuery = query(
      collection(db, 'wallets'),
      where('userId', '==', userId),
      orderBy('name'),
    )

    const unsubscribe = onSnapshot(walletsQuery, snapshot => {
      const data = snapshot.docs.map(
        doc =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Wallet,
      )
      setWalletsById(
        data.reduce<Record<string, Wallet>>((acc, wallet) => {
          acc[wallet.id] = wallet
          return acc
        }, {}),
      )
    })

    return () => unsubscribe()
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setTransactions([])
      onTransactionsChange?.([])
      return
    }

    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
    )

    const unsubscribe = onSnapshot(txQuery, snapshot => {
      const data = snapshot.docs.map(
        doc =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Transaction,
      )

      setTransactions(data)
      onTransactionsChange?.(data)
    })

    return () => unsubscribe()
  }, [userId, onTransactionsChange])

  const enrichedTransactions = useMemo(() => {
    return transactions.map(tx => {
      const card = tx.cardId ? cardsById[tx.cardId] : undefined
      const sourceName =
        tx.sourceType === 'card'
          ? cardsById[tx.sourceId]?.alias || cardsById[tx.sourceId]?.issuer
          : walletsById[tx.sourceId]?.name

      return {
        ...tx,
        card,
        sourceName,
      }
    })
  }, [transactions, cardsById, walletsById])

  return (
    <div className="space-y-3 rounded border border-slate-800 bg-slate-900/30 p-5 shadow">
      <h3 className="text-lg font-semibold text-slate-100">Recent Transactions</h3>
      {enrichedTransactions.length === 0 && (
        <p className="text-sm text-slate-500">No transactions recorded yet.</p>
      )}
      <ul className="space-y-2">
        {enrichedTransactions.map(tx => (
          <li
            key={tx.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/60 p-3"
          >
            <div>
              <p className="text-sm font-semibold text-slate-100">
                {tx.merchant}
                <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">
                  {tx.category}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {dateFormatter.format(new Date(tx.date))} ·{' '}
                {tx.sourceType === 'card' ? 'Card' : 'Wallet'} · {tx.sourceName ?? 'Unknown source'}
              </p>
              {tx.note && <p className="mt-1 text-xs text-slate-400">{tx.note}</p>}
            </div>
            <div className="text-right">
              <p className="text-base font-semibold text-emerald-400">
                {currencyFormatter.format(tx.amount)}
              </p>
              {tx.affectCurrentBill ? (
                <p className="text-xs text-emerald-500">Counts toward bill</p>
              ) : (
                <p className="text-xs text-slate-500">Excluded from bill</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
