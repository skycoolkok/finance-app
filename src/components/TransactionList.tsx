import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'

import { db } from '../firebase'
import type { Card, Transaction, Wallet } from '../models/types'
import { date } from '../lib/fmt'
import { normalizeLanguageTag } from '../lib/language'
import { formatCurrency, type CurrencyCode, type Rates } from '../lib/money'

type TransactionListProps = {
  userId: string | null
  onTransactionsChange?: (transactions: Transaction[]) => void
  preferredCurrency: CurrencyCode
  rates: Rates
}

export default function TransactionList({
  userId,
  onTransactionsChange,
  preferredCurrency,
  rates,
}: TransactionListProps) {
  const { t, i18n } = useTranslation()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cardsById, setCardsById] = useState<Record<string, Card>>({})
  const [walletsById, setWalletsById] = useState<Record<string, Wallet>>({})
  const locale = normalizeLanguageTag(i18n.resolvedLanguage || i18n.language)

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

    const unsubscribe = onSnapshot(cardsQuery, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) =>
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

    const unsubscribe = onSnapshot(walletsQuery, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) =>
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

    const unsubscribe = onSnapshot(txQuery, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) =>
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
    return transactions.map((tx) => {
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
      <h3 className="text-lg font-semibold text-slate-100">{t('transactions.list.title')}</h3>
      {enrichedTransactions.length === 0 && (
        <p className="text-sm text-slate-500">{t('transactions.list.empty')}</p>
      )}
      <ul className="space-y-2">
        {enrichedTransactions.map((tx) => (
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
                {date(tx.date, locale)} ·{' '}
                {tx.sourceType === 'card'
                  ? t('transactions.form.fields.sourceType.options.card')
                  : t('transactions.form.fields.sourceType.options.wallet')}{' '}
                · {tx.sourceName ?? t('transactions.list.source.unknown')}
              </p>
              {tx.note && <p className="mt-1 text-xs text-slate-400">{tx.note}</p>}
            </div>
            <div className="text-right">
              <p className="text-base font-semibold text-emerald-400">
                {formatCurrency(tx.amount, { currency: preferredCurrency, lng: locale, rates })}
              </p>
              {tx.affectCurrentBill ? (
                <p className="text-xs text-emerald-500">
                  {t('transactions.list.flags.affectsBill')}
                </p>
              ) : (
                <p className="text-xs text-slate-500">{t('transactions.list.flags.excluded')}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
