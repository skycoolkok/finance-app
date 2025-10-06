import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { Card } from '../models/types'

type CardListProps = {
  userId: string | null
  onEdit: (card: Card) => void
}

export default function CardList({ userId, onEdit }: CardListProps) {
  const [cards, setCards] = useState<Card[]>([])

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
        item =>
          ({
            id: item.id,
            ...item.data(),
          }) as Card,
      )

      setCards(data)
    })

    return () => unsubscribe()
  }, [userId])

  const handleDelete = async (cardId: string) => {
    try {
      await deleteDoc(doc(db, 'cards', cardId))
      alert('Card deleted')
    } catch (error) {
      console.error(error)
      alert('Error deleting card')
    }
  }

  return (
    <div className="space-y-2 p-4">
      <h2 className="text-lg font-bold">My Cards</h2>
      {cards.length === 0 && (
        <p className="text-sm text-slate-500">No cards yet. Add your first card above.</p>
      )}
      {cards.map(card => (
        <div
          key={card.id}
          className="flex flex-wrap items-center justify-between gap-4 rounded border p-3 shadow"
        >
          <div>
            <p className="font-medium">
              {card.alias} <span className="text-slate-500">({card.issuer})</span>
            </p>
            <p className="text-sm text-slate-500">**** {card.last4}</p>
          </div>
          <div className="text-right text-sm">
            <p>Limit: {card.limitAmount}</p>
            <p>Due: {card.dueDay}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(card)}
              className="rounded border border-blue-500 px-3 py-1 text-blue-500"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleDelete(card.id)}
              className="rounded border border-red-500 px-3 py-1 text-red-500"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
