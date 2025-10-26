import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { addDoc, collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { Card, Transaction, Wallet } from '../models/types'

type TransactionFormProps = {
  userId: string | null
}

type TransactionFormState = {
  date: string
  amount: string
  merchant: string
  category: string
  sourceType: 'card' | 'wallet'
  sourceId: string
  affectCurrentBill: boolean
  note: string
}

const INITIAL_STATE: TransactionFormState = {
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  merchant: '',
  category: '',
  sourceType: 'card',
  sourceId: '',
  affectCurrentBill: true,
  note: '',
}

export default function TransactionForm({ userId }: TransactionFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<TransactionFormState>(INITIAL_STATE)
  const [cards, setCards] = useState<Card[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])

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
      setWallets([])
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
      setWallets(data)
    })

    return () => unsubscribe()
  }, [userId])

  useEffect(() => {
    setForm((prev) => {
      const sources = prev.sourceType === 'card' ? cards : wallets
      if (sources.length === 0) {
        return { ...prev, sourceId: '' }
      }

      const exists = sources.some((item) => item.id === prev.sourceId)
      if (exists) {
        return prev
      }

      return {
        ...prev,
        sourceId: sources[0].id,
      }
    })
  }, [cards, wallets])

  const availableSources = useMemo(() => {
    return form.sourceType === 'card' ? cards : wallets
  }, [cards, wallets, form.sourceType])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target

    if (type === 'checkbox' && 'checked' in event.target) {
      setForm((prev) => ({
        ...prev,
        [name]: (event.target as HTMLInputElement).checked,
      }))
      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSourceTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as 'card' | 'wallet'
    const sources = nextType === 'card' ? cards : wallets

    setForm((prev) => ({
      ...prev,
      sourceType: nextType,
      sourceId: sources.length > 0 ? sources[0].id : '',
    }))
  }

  const handleSourceIdChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    setForm((prev) => ({
      ...prev,
      sourceId: value,
    }))
  }

  const resetForm = () => {
    setForm((prev) => ({
      ...INITIAL_STATE,
      date: new Date().toISOString().slice(0, 10),
      sourceType: prev.sourceType,
      sourceId: '',
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) {
      alert(t('transactions.form.messages.missingUser'))
      return
    }

    if (!form.sourceId) {
      alert(t('transactions.form.messages.missingSource'))
      return
    }

    const numericAmount = Number(form.amount)
    if (Number.isNaN(numericAmount)) {
      alert(t('transactions.form.messages.invalidAmount'))
      return
    }

    try {
      const resolvedCardId = (() => {
        if (form.sourceType === 'card') {
          return form.sourceId
        }
        const wallet = wallets.find((item) => item.id === form.sourceId)
        return wallet?.linkedCardId ?? null
      })()

      const payload: Omit<Transaction, 'id'> = {
        date: form.date,
        amount: numericAmount,
        merchant: form.merchant.trim(),
        category: form.category.trim(),
        sourceType: form.sourceType,
        sourceId: form.sourceId,
        affectCurrentBill: form.affectCurrentBill,
        cardId: resolvedCardId ?? null,
        note: form.note.trim() ? form.note.trim() : undefined,
        userId,
      }

      await addDoc(collection(db, 'transactions'), payload)
      alert(t('transactions.form.messages.createSuccess'))
      resetForm()
    } catch (error) {
      console.error(error)
      alert(t('transactions.form.messages.saveError'))
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded border border-slate-800 bg-slate-900/40 p-5 shadow"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">{t('transactions.form.title')}</h3>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="affectCurrentBill"
            checked={form.affectCurrentBill}
            onChange={handleInputChange}
            className="h-4 w-4 rounded border-slate-600 bg-slate-950"
          />
          {t('transactions.form.fields.affectCurrentBill')}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="transaction-date" className="text-sm text-slate-300">
            {t('transactions.form.fields.date')}
          </label>
          <input
            id="transaction-date"
            type="date"
            name="date"
            value={form.date}
            onChange={handleInputChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="transaction-amount" className="text-sm text-slate-300">
            {t('transactions.form.fields.amount')}
          </label>
          <input
            id="transaction-amount"
            type="number"
            name="amount"
            step="0.01"
            value={form.amount}
            onChange={handleInputChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
            required
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="transaction-merchant" className="text-sm text-slate-300">
            {t('transactions.form.fields.merchant.label')}
          </label>
          <input
            id="transaction-merchant"
            name="merchant"
            placeholder={t('transactions.form.fields.merchant.placeholder')}
            value={form.merchant}
            onChange={handleInputChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="transaction-category" className="text-sm text-slate-300">
            {t('transactions.form.fields.category.label')}
          </label>
          <input
            id="transaction-category"
            name="category"
            placeholder={t('transactions.form.fields.category.placeholder')}
            value={form.category}
            onChange={handleInputChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
            required
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="transaction-source-type" className="text-sm text-slate-300">
            {t('transactions.form.fields.sourceType.label')}
          </label>
          <select
            id="transaction-source-type"
            value={form.sourceType}
            onChange={handleSourceTypeChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
          >
            <option value="card">{t('transactions.form.fields.sourceType.options.card')}</option>
            <option value="wallet">
              {t('transactions.form.fields.sourceType.options.wallet')}
            </option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="transaction-source" className="text-sm text-slate-300">
            {form.sourceType === 'card'
              ? t('transactions.form.fields.source.label.card')
              : t('transactions.form.fields.source.label.wallet')}
          </label>
          <select
            id="transaction-source"
            value={form.sourceId}
            onChange={handleSourceIdChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
            required
          >
            <option value="" disabled>
              {t('transactions.form.fields.source.placeholder', {
                type:
                  form.sourceType === 'card'
                    ? t('transactions.form.fields.sourceType.options.card')
                    : t('transactions.form.fields.sourceType.options.wallet'),
              })}
            </option>
            {availableSources.map((source) => {
              const label =
                form.sourceType === 'card'
                  ? t('transactions.form.fields.source.cardOption', {
                      name: (source as Card).alias?.trim() || (source as Card).issuer,
                      issuer: (source as Card).issuer,
                      last4: (source as Card).last4?.toString().slice(-4) ?? '0000',
                    })
                  : t('transactions.form.fields.source.walletOption', {
                      name: (source as Wallet).name,
                      defaultLabel: (source as Wallet).isDefault
                        ? ` (${t('wallets.list.defaultBadge')})`
                        : '',
                    })
              return (
                <option key={source.id} value={source.id}>
                  {label}
                </option>
              )
            })}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="transaction-note" className="text-sm text-slate-300">
          {t('transactions.form.fields.note.label')}
        </label>
        <textarea
          id="transaction-note"
          name="note"
          value={form.note}
          onChange={handleInputChange}
          placeholder={t('transactions.form.fields.note.placeholder')}
          className="h-20 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded bg-blue-500 px-4 py-2 font-medium text-white transition hover:bg-blue-400"
      >
        {t('transactions.form.actions.submit')}
      </button>
    </form>
  )
}
