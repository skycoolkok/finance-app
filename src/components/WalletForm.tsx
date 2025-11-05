import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Card, Wallet } from '../models/types'

type WalletFormProps = {
  userId: string | null
  existingWallet?: Wallet | null
  onComplete?: () => void
}

type WalletFormState = {
  name: string
  linkedCardId: string
  isDefault: boolean
  note: string
}

const INITIAL_STATE: WalletFormState = {
  name: '',
  linkedCardId: '',
  isDefault: false,
  note: '',
}

export default function WalletForm({ userId, existingWallet, onComplete }: WalletFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<WalletFormState>(INITIAL_STATE)
  const [cards, setCards] = useState<Card[]>([])

  const isEditing = useMemo(() => Boolean(existingWallet), [existingWallet])

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
        (cardDoc) =>
          ({
            id: cardDoc.id,
            ...cardDoc.data(),
          }) as Card,
      )

      setCards(data)
    })

    return () => unsubscribe()
  }, [userId])

  useEffect(() => {
    if (existingWallet) {
      setForm({
        name: existingWallet.name ?? '',
        linkedCardId: existingWallet.linkedCardId ?? '',
        isDefault: Boolean(existingWallet.isDefault),
        note: existingWallet.note ?? '',
      })
    } else {
      setForm(INITIAL_STATE)
    }
  }, [existingWallet])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    setForm((prev) => ({
      ...prev,
      linkedCardId: value,
    }))
  }

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target
    setForm((prev) => ({
      ...prev,
      isDefault: checked,
    }))
  }

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target
    setForm((prev) => ({
      ...prev,
      note: value,
    }))
  }

  const resetState = () => {
    setForm(INITIAL_STATE)
    onComplete?.()
  }

  const clearOtherDefaultWallets = async () => {
    if (!form.isDefault || !userId) {
      return
    }

    const walletsQuery = query(
      collection(db, 'wallets'),
      where('userId', '==', userId),
      where('isDefault', '==', true),
    )

    const snapshot = await getDocs(walletsQuery)
    if (snapshot.empty) {
      return
    }

    const batch = writeBatch(db)
    let hasUpdates = false

    snapshot.forEach((walletDoc) => {
      if (walletDoc.id === existingWallet?.id) {
        return
      }

      batch.update(walletDoc.ref, { isDefault: false })
      hasUpdates = true
    })

    if (hasUpdates) {
      await batch.commit()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) {
      alert(t('wallets.form.messages.missingUser'))
      return
    }

    try {
      await clearOtherDefaultWallets()

      // ✅ 這段會把可能是 undefined 的欄位改成 Firestore 接受的型態
      const payload: Omit<Wallet, 'id'> = {
        name: form.name.trim(),
        linkedCardId: form.linkedCardId ? form.linkedCardId : null, // 沒選卡片 → null
        isDefault: !!form.isDefault,
        note: form.note?.trim() ?? '', // 沒填備註 → 空字串
        userId,
      }

      if (isEditing && existingWallet) {
        await updateDoc(doc(db, 'wallets', existingWallet.id), payload)
        alert(t('wallets.form.messages.updateSuccess'))
      } else {
        await addDoc(collection(db, 'wallets'), payload)
        alert(t('wallets.form.messages.createSuccess'))
      }

      resetState()
    } catch (error) {
      console.error(error)
      alert(t('wallets.form.messages.saveError'))
    }
  }

  const handleCancel = () => {
    resetState()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded border border-slate-800 bg-slate-900/50 p-4 shadow"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          {isEditing ? t('wallets.form.title.edit') : t('wallets.form.title.create')}
        </h3>
        {isEditing && (
          <button type="button" onClick={handleCancel} className="text-sm text-slate-400 underline">
            {t('wallets.form.actions.cancel')}
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-300" htmlFor="wallet-name">
          {t('wallets.form.labels.name')}
        </label>
        <input
          id="wallet-name"
          name="name"
          placeholder={t('wallets.form.placeholders.name')}
          value={form.name}
          onChange={handleInputChange}
          className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100 placeholder:text-slate-500"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-300" htmlFor="wallet-card">
          {t('wallets.form.labels.linkedCard')}
        </label>
        <select
          id="wallet-card"
          value={form.linkedCardId}
          onChange={handleSelectChange}
          className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
        >
          <option value="">{t('wallets.form.placeholders.linkedCardNone')}</option>
          {cards.map((card) => {
            const displayName = (card.alias ?? '').trim() || card.issuer
            return (
              <option key={card.id} value={card.id}>
                {t('wallets.form.options.linkedCard', {
                  name: displayName,
                  issuer: card.issuer,
                  last4: card.last4?.toString().slice(-4) ?? '0000',
                })}
              </option>
            )
          })}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={handleCheckboxChange}
          className="h-4 w-4 rounded border-slate-600 bg-slate-950"
        />
        {t('wallets.form.checkbox')}
      </label>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-300" htmlFor="wallet-note">
          {t('wallets.form.labels.note')}
        </label>
        <textarea
          id="wallet-note"
          value={form.note}
          onChange={handleTextareaChange}
          placeholder={t('wallets.form.placeholders.note')}
          className="h-24 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded bg-emerald-500 px-4 py-2 font-medium text-white transition hover:bg-emerald-400"
      >
        {isEditing ? t('wallets.form.actions.update') : t('wallets.form.actions.create')}
      </button>
    </form>
  )
}
