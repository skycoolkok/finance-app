import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { Card, Wallet } from '../models/types'

type WalletListProps = {
  userId: string | null
  onEdit: (wallet: Wallet) => void
}

export default function WalletList({ userId, onEdit }: WalletListProps) {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [cardsById, setCardsById] = useState<Record<string, Card>>({})

  useEffect(() => {
    if (!userId) {
      setCardsById({})
      return
    }

    const cardsQuery = query(collection(db, 'cards'), where('userId', '==', userId))

    const unsubscribe = onSnapshot(cardsQuery, snapshot => {
      const data = snapshot.docs.map(
        cardDoc =>
          ({
            id: cardDoc.id,
            ...cardDoc.data(),
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
      setWallets([])
      return
    }

    const walletsQuery = query(collection(db, 'wallets'), where('userId', '==', userId))

    const unsubscribe = onSnapshot(walletsQuery, snapshot => {
      const data = snapshot.docs.map(
        walletDoc =>
          ({
            id: walletDoc.id,
            ...walletDoc.data(),
          }) as Wallet,
      )

      setWallets(data)
    })

    return () => unsubscribe()
  }, [userId])

  const handleDelete = async (walletId: string) => {
    const confirmed = window.confirm('Delete this wallet?')
    if (!confirmed) {
      return
    }

    try {
      await deleteDoc(doc(db, 'wallets', walletId))
      alert('Wallet deleted')
    } catch (error) {
      console.error(error)
      alert('Error deleting wallet')
    }
  }

  return (
    <div className="space-y-3 rounded border border-slate-800 bg-slate-900/30 p-4 shadow">
      <h3 className="text-lg font-semibold text-slate-100">Wallets</h3>
      {wallets.length === 0 && (
        <p className="text-sm text-slate-500">No wallets yet. Create one to get started.</p>
      )}
      {wallets.map(wallet => {
        const linkedCard = wallet.linkedCardId ? cardsById[wallet.linkedCardId] : undefined

        return (
          <div
            key={wallet.id}
            className="rounded border border-slate-800 bg-slate-950/70 p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-medium text-slate-100">{wallet.name}</p>
                <p className="text-sm text-slate-500">
                  {linkedCard ? `${linkedCard.issuer}@${linkedCard.last4}` : 'No linked card'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {wallet.isDefault && (
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                    Default
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(wallet)}
                  className="rounded border border-blue-500 px-3 py-1 text-sm text-blue-400"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(wallet.id)}
                  className="rounded border border-red-500 px-3 py-1 text-sm text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
            {wallet.note && <p className="mt-2 text-sm text-slate-400">{wallet.note}</p>}
          </div>
        )
      })}
    </div>
  )
}
