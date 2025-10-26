import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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

    setForm((prev) => ({
      ...prev,
      [key]: nextValue,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) {
      alert(t('cards.form.messages.missingUser'))
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
        alert(t('cards.form.messages.updateSuccess'))
      } else {
        await addDoc(collection(db, 'cards'), payload)
        alert(t('cards.form.messages.createSuccess'))
      }

      setForm(INITIAL_STATE)
      onComplete?.()
    } catch (error) {
      console.error(error)
      alert(t('cards.form.messages.saveError'))
    }
  }

  const handleCancel = () => {
    setForm(INITIAL_STATE)
    onComplete?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded border p-4">
      <h2 className="text-lg font-semibold">
        {isEditing ? t('cards.form.title.edit') : t('cards.form.title.create')}
      </h2>
      <input
        name="alias"
        placeholder={t('cards.form.placeholders.alias')}
        value={form.alias}
        onChange={handleChange}
        className="w-full rounded border p-2"
        required
      />
      <input
        name="issuer"
        placeholder={t('cards.form.placeholders.issuer')}
        value={form.issuer}
        onChange={handleChange}
        className="w-full rounded border p-2"
        required
      />
      <input
        name="last4"
        placeholder={t('cards.form.placeholders.last4')}
        value={form.last4}
        onChange={handleChange}
        maxLength={4}
        className="w-full rounded border p-2"
        required
      />
      <input
        type="number"
        name="statementDay"
        placeholder={t('cards.form.placeholders.statementDay')}
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
        placeholder={t('cards.form.placeholders.dueDay')}
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
        placeholder={t('cards.form.placeholders.limitAmount')}
        value={form.limitAmount}
        onChange={handleChange}
        className="w-full rounded border p-2"
        min={0}
        required
      />
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-white">
          {isEditing ? t('cards.form.actions.update') : t('cards.form.actions.create')}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-slate-400 px-4 py-2 text-slate-700"
          >
            {t('cards.form.actions.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
