import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { onAuthStateChanged, type User } from 'firebase/auth'

import CardForm from './components/CardForm'
import CardList from './components/CardList'
import { Dashboard } from './components/Dashboard'
import { NotificationCenter } from './components/NotificationCenter'
import { DiagBadge } from './components/DiagBadge'
import DashboardLayout from './layouts/DashboardLayout'
import { HealthCheck } from './components/HealthCheck'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import WalletForm from './components/WalletForm'
import WalletList from './components/WalletList'
import { useFxRates } from './hooks/useFxRates'
import { useUserPrefs } from './hooks/useUserPrefs'
import { initFcmAndRegister } from './messaging'
import { auth } from './firebase'
import { checkFxAdmin, initUserProfile } from './functions'
import { buildId } from './version'
import type { Card, Wallet } from './models/types'

export default function App() {
  const { t, i18n } = useTranslation()
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser)
  const [authLoading, setAuthLoading] = useState(() => !auth.currentUser)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null)
  const [isWalletFormOpen, setIsWalletFormOpen] = useState(false)
  const isHealthRoute = typeof window !== 'undefined' && window.location.pathname === '/__health'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser)
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // src/App.tsx 內，保持你前面的程式不動，只替換這個 useEffect 區塊
useEffect(() => {
  if (isHealthRoute || authLoading || !authUser) return;

  void initUserProfile({ locale: i18n.language }).catch((error) => {
    if (import.meta.env.DEV) {
      console.error('initUserProfile failed', error);
    }
  });
}, [isHealthRoute, authLoading, authUser, i18n.language]);


  const userId = authUser?.uid ?? null

  const { preferredCurrency, loading: currencyLoading } = useUserPrefs(userId)

  const shouldSubscribeFx = Boolean(authUser)
  const {
    rates,
    loading: ratesLoading,
    active: ratesActive,
    effectiveDate: ratesEffectiveDate,
    source: ratesSource,
    updatedAt: ratesUpdatedAt,
  } = useFxRates(shouldSubscribeFx)

  const userEmail = authUser?.email ?? null
  const [fxAdminState, setFxAdminState] = useState<'guest' | 'checking' | 'allowed' | 'denied'>(
    authUser ? 'checking' : 'guest',
  )

  const fxAdminTitle = useMemo(
    () => t('settings.preferences.fxRatesAdmin.title', 'FX Rates · Admin'),
    [t],
  )

  useEffect(() => {
    if (!authUser) {
      setFxAdminState('guest')
      return
    }
    if (!userEmail) {
      setFxAdminState('denied')
      return
    }
    let active = true
    setFxAdminState('checking')

    void checkFxAdmin({ email: userEmail })
      .then((result) => {
        if (!active) return
        const allowed = result.data?.allowed ?? false
        setFxAdminState(allowed ? 'allowed' : 'denied')
      })
      .catch(() => {
        if (active) setFxAdminState('denied')
      })

    return () => {
      active = false
    }
  }, [authUser, userEmail])

  useEffect(() => {
    if (isHealthRoute || !authUser) return
    initFcmAndRegister(authUser.uid).catch((error) => {
      console.error('FCM initialization failed', error)
    })
  }, [authUser, isHealthRoute])

  useEffect(() => {
    if (import.meta.env.DEV && !isHealthRoute) {
      console.log('[i18n] active language:', i18n.language)
      console.log('[i18n] sample title:', t('app.title'))
    }
  }, [i18n.language, isHealthRoute, t])

  if (isHealthRoute) {
    return (
      <HealthCheck
        preferredCurrency={preferredCurrency}
        currencyLoading={currencyLoading}
        rates={rates}
        ratesLoading={ratesLoading}
        ratesActive={ratesActive}
        ratesEffectiveDate={ratesEffectiveDate}
        ratesSource={ratesSource}
        ratesUpdatedAt={ratesUpdatedAt}
      />
    )
  }

  const handleEditCard = (card: Card) => setEditingCard(card)
  const handleCardFormComplete = () => setEditingCard(null)
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

  const adminStatusMessage = (() => {
    if (authLoading || fxAdminState === 'checking') {
      return t('settings.preferences.fxRatesAdmin.checking', 'Checking admin permissions...')
    }
    if (!authUser) {
      return t('settings.preferences.fxRatesAdmin.loginPrompt', 'Sign in to manage exchange rates.')
    }
    if (fxAdminState !== 'allowed') {
      return t(
        'settings.preferences.fxRatesAdmin.noPermission',
        'You do not have permission to manage exchange rates.',
      )
    }
    return t('settings.preferences.fxRatesAdmin.ready', 'FX rate controls will appear here soon.')
  })()

  const drawerSupportContent = (
    <div className="space-y-2 text-sm text-slate-300">
      <p className="font-semibold text-slate-100">{fxAdminTitle}</p>
      <p>{adminStatusMessage}</p>
      <p className="text-xs text-slate-500">
        {t('settings.preferences.fxRatesAdmin.ratesMeta', {
          defaultValue: 'Last updated: {{date}} · Source: {{source}}',
          date: ratesUpdatedAt ?? t('common.unknown', 'unknown'),
          source: ratesSource ?? t('common.unknown', 'unknown'),
        })}
      </p>
    </div>
  )

  return (
    <DashboardLayout
      user={authUser}
      authLoading={authLoading}
      sidebar={<NotificationCenter userId={userId} authReady={!authLoading} />}
      drawerContent={drawerSupportContent}
    >
      {import.meta.env.DEV ? <DiagBadge preferredCurrency={preferredCurrency} /> : null}

      <Dashboard
        userId={userId}
        preferredCurrency={preferredCurrency}
        currencyLoading={currencyLoading}
        rates={rates}
        ratesLoading={ratesLoading}
        ratesActive={ratesActive}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
          <h2 className="text-xl font-semibold">{t('cards.sectionTitle')}</h2>
          <CardForm
            userId={userId}
            existingCard={editingCard}
            onComplete={handleCardFormComplete}
          />
          <CardList
            userId={userId}
            onEdit={handleEditCard}
            preferredCurrency={preferredCurrency}
            rates={rates}
          />
        </div>

        <div className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t('wallets.sectionTitle')}</h2>
            <button
              type="button"
              onClick={handleAddWallet}
              className="rounded bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
            >
              {t('wallets.form.actions.create')}
            </button>
          </div>

          {isWalletFormOpen ? (
            <WalletForm
              userId={userId}
              existingWallet={editingWallet}
              onComplete={handleWalletFormComplete}
            />
          ) : null}

          <WalletList userId={userId} onEdit={handleEditWallet} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <TransactionForm userId={userId} />
        <TransactionList userId={userId} preferredCurrency={preferredCurrency} rates={rates} />
      </section>

      <footer className="text-right text-xs text-slate-500">Build: {buildId}</footer>
    </DashboardLayout>
  )
}
