import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Card } from '../models/types'

type CardFormState = {
  alias: string
  issuer: string
  last4: string
  statementDay: number | ''
  dueDay: number | ''
  limitAmount: number | ''
}

type CardFormProps = {
  userId: string | null
  existingCard?: Card | null
  onComplete?: () => void
}

const INITIAL_STATE: CardFormState = {
  alias: '',
  issuer: '',
  last4: '',
  statementDay: 1,
  dueDay: 10,
  limitAmount: 0,
}

export default function CardForm({ userId, existingCard, onComplete }: CardFormProps) {
  const [form, setForm] = useState<CardFormState>(INITIAL_STATE)

  const isEditing = useMemo(() => Boolean(existingCard), [existingCard])

  useEffect(() => {
    if (existingCard) {
      setForm({
        alias: existingCard.alias ?? '',
        issuer: existingCard.issuer ?? '',
        last4: existingCard.last4 ?? '',
        statementDay: existingCard.statementDay ?? 1,
        dueDay: existingCard.dueDay ?? 10,
        limitAmount: existingCard.limitAmount ?? 0,
      })
    } else {
      setForm(INITIAL_STATE)
    }
  }, [existingCard])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = event.target
    const key = name as keyof CardFormState
    const nextValue = type === 'number' ? (value === '' ? '' : Number(value)) : value

    setForm(prev => ({
      ...prev,
      [key]: nextValue,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) {
      alert('User not available. Please sign in to manage cards.')
      return
    }

    try {
      const payload: Omit<Card, 'id'> = {
        alias: form.alias.trim(),
        issuer: form.issuer.trim(),
        last4: form.last4.trim(),
        statementDay: Number(form.statementDay),
        dueDay: Number(form.dueDay),
        limitAmount: Number(form.limitAmount),
        userId,
      }

      if (isEditing && existingCard) {
        await updateDoc(doc(db, 'cards', existingCard.id), payload)
        alert('Card updated!')
      } else {
        await addDoc(collection(db, 'cards'), payload)
        alert('Card added!')
      }

      setForm(INITIAL_STATE)
      onComplete?.()
    } catch (error) {
      console.error(error)
      alert('Error saving card')
    }
  }

  const handleCancel = () => {
    setForm(INITIAL_STATE)
    onComplete?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded border p-4">
      <h2 className="text-lg font-semibold">{isEditing ? 'Edit Card' : 'Add Card'}</h2>
      <input
        name="alias"
        placeholder="Card Name"
        value={form.alias}
        onChange={handleChange}
        className="w-full rounded border p-2"
        required
      />
      <input
        name="issuer"
        placeholder="Bank"
        value={form.issuer}
        onChange={handleChange}
        className="w-full rounded border p-2"
        required
      />
      <input
        name="last4"
        placeholder="Last 4 digits"
        value={form.last4}
        onChange={handleChange}
        maxLength={4}
        className="w-full rounded border p-2"
        required
      />
      <input
        type="number"
        name="statementDay"
        placeholder="Statement Day"
        value={form.statementDay}
        onChange={handleChange}
        className="w-full rounded border p-2"
        min={1}
        max={31}
        required
      />
      <input
        type="number"
        name="dueDay"
        placeholder="Due Day"
        value={form.dueDay}
        onChange={handleChange}
        className="w-full rounded border p-2"
        min={1}
        max={31}
        required
      />
      <input
        type="number"
        name="limitAmount"
        placeholder="Limit Amount"
        value={form.limitAmount}
        onChange={handleChange}
        className="w-full rounded border p-2"
        min={0}
        required
      />
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-white">
          {isEditing ? 'Update Card' : 'Add Card'}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-slate-400 px-4 py-2 text-slate-700"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
