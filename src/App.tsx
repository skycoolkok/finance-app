import { useEffect, useState } from 'react'
import CardForm from './components/CardForm'
import CardList from './components/CardList'
import { Dashboard } from './components/Dashboard'
import { NotificationCenter } from './components/NotificationCenter'
import { SettingsNotifications } from './components/SettingsNotifications'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import WalletForm from './components/WalletForm'
import WalletList from './components/WalletList'
import { initFcmAndRegister } from './messaging'
import { auth } from './firebase'
import type { Card, Wallet } from './models/types'

export default function App() {
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null)
  const [isWalletFormOpen, setIsWalletFormOpen] = useState(false)

  const userId = auth.currentUser?.uid ?? 'demo-user'

  useEffect(() => {
    initFcmAndRegister(userId).catch(error => {
      console.error('FCM initialization failed', error)
    })
  }, [userId])

  const handleEditCard = (card: Card) => {
    setEditingCard(card)
  }

  const handleCardFormComplete = () => {
    setEditingCard(null)
  }

  const handleAddWallet = () => {
    setEditingWallet(null)
    setIsWalletFormOpen(true)
  }

  const handleEditWallet = (wallet: Wallet) => {
    setEditingWallet(wallet)
    setIsWalletFormOpen(true)
  }

  const handleWalletFormComplete = () => {
    setEditingWallet(null)
    setIsWalletFormOpen(false)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 text-slate-100">
      <header className="rounded border border-slate-800 bg-slate-900/40 p-6 shadow">
        <h1 className="text-3xl font-bold">Finance App</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage cards, wallets, transactions, and reminders with Firestore-backed, real-time
          updates.
        </p>
      </header>

      <Dashboard userId={userId} />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
          <h2 className="text-xl font-semibold">Cards</h2>
          <CardForm
            userId={userId}
            existingCard={editingCard}
            onComplete={handleCardFormComplete}
          />
          <CardList userId={userId} onEdit={handleEditCard} />
        </div>

        <div className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Wallets</h2>
            <button
              type="button"
              onClick={handleAddWallet}
              className="rounded bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
            >
              Add Wallet
            </button>
          </div>
          {isWalletFormOpen && (
            <WalletForm
              userId={userId}
              existingWallet={editingWallet}
              onComplete={handleWalletFormComplete}
            />
          )}
          <WalletList userId={userId} onEdit={handleEditWallet} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <TransactionForm userId={userId} />
        <TransactionList userId={userId} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <NotificationCenter userId={userId} />
        <SettingsNotifications userId={userId} />
      </section>
    </div>
  )
}
