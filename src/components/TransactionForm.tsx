import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
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

    const unsubscribe = onSnapshot(cardsQuery, snapshot => {
      const data = snapshot.docs.map(
        doc =>
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

    const unsubscribe = onSnapshot(walletsQuery, snapshot => {
      const data = snapshot.docs.map(
        doc =>
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
    setForm(prev => {
      const sources = prev.sourceType === 'card' ? cards : wallets
      if (sources.length === 0) {
        return { ...prev, sourceId: '' }
      }

      const exists = sources.some(item => item.id === prev.sourceId)
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
      setForm(prev => ({
        ...prev,
        [name]: (event.target as HTMLInputElement).checked,
      }))
      return
    }

    setForm(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSourceTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as 'card' | 'wallet'
    const sources = nextType === 'card' ? cards : wallets

    setForm(prev => ({
      ...prev,
      sourceType: nextType,
      sourceId: sources.length > 0 ? sources[0].id : '',
    }))
  }

  const handleSourceIdChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    setForm(prev => ({
      ...prev,
      sourceId: value,
    }))
  }

  const resetForm = () => {
    setForm(prev => ({
      ...INITIAL_STATE,
      date: new Date().toISOString().slice(0, 10),
      sourceType: prev.sourceType,
      sourceId: '',
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) {
      alert('Please sign in before adding transactions.')
      return
    }

    if (!form.sourceId) {
      alert('Please select a source before saving the transaction.')
      return
    }

    const numericAmount = Number(form.amount)
    if (Number.isNaN(numericAmount)) {
      alert('Amount must be a number.')
      return
    }

    try {
      const resolvedCardId = (() => {
        if (form.sourceType === 'card') {
          return form.sourceId
        }
        const wallet = wallets.find(item => item.id === form.sourceId)
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
      alert('Transaction recorded!')
      resetForm()
    } catch (error) {
      console.error(error)
      alert('Failed to save transaction')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded border border-slate-800 bg-slate-900/40 p-5 shadow"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Add Transaction</h3>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="affectCurrentBill"
            checked={form.affectCurrentBill}
            onChange={handleInputChange}
            className="h-4 w-4 rounded border-slate-600 bg-slate-950"
          />
          Affect current bill
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="transaction-date" className="text-sm text-slate-300">
            Date
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
            Amount
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
            Merchant
          </label>
          <input
            id="transaction-merchant"
            name="merchant"
            placeholder="Store name"
            value={form.merchant}
            onChange={handleInputChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="transaction-category" className="text-sm text-slate-300">
            Category
          </label>
          <input
            id="transaction-category"
            name="category"
            placeholder="Dining, Travel, etc."
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
            Source Type
          </label>
          <select
            id="transaction-source-type"
            value={form.sourceType}
            onChange={handleSourceTypeChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
          >
            <option value="card">Card</option>
            <option value="wallet">Wallet</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="transaction-source" className="text-sm text-slate-300">
            {form.sourceType === 'card' ? 'Card' : 'Wallet'}
          </label>
          <select
            id="transaction-source"
            value={form.sourceId}
            onChange={handleSourceIdChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
            required
          >
            <option value="" disabled>
              Select {form.sourceType}
            </option>
            {availableSources.map(item => (
              <option key={item.id} value={item.id}>
                {'issuer' in item
                  ? `${item.alias || item.issuer} (${item.issuer}@${item.last4})`
                  : `${item.name}${item.isDefault ? ' • Default' : ''}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="transaction-note" className="text-sm text-slate-300">
          Note
        </label>
        <textarea
          id="transaction-note"
          name="note"
          value={form.note}
          onChange={handleInputChange}
          placeholder="Optional notes"
          className="h-20 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded bg-blue-500 px-4 py-2 font-medium text-white transition hover:bg-blue-400"
      >
        Save Transaction
      </button>
    </form>
  )
}
