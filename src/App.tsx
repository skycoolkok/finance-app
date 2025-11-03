import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { onAuthStateChanged, type User } from 'firebase/auth'




import CardForm from './components/CardForm'
import CardList from './components/CardList'
import { Dashboard } from './components/Dashboard'
import { NotificationCenter } from './components/NotificationCenter'
import { DiagBadge } from './components/DiagBadge'
import AuthButton from './components/AuthButton'
import FxAdminPlaceholder from './components/FxAdminPlaceholder'
import { HealthCheck } from './components/HealthCheck'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import WalletForm from './components/WalletForm'
import WalletList from './components/WalletList'
import { useFxRates } from './hooks/useFxRates'
import { useUserPrefs } from './hooks/useUserPrefs'
import { initFcmAndRegister } from './messaging'
import { auth } from './firebase'
import { checkFxAdmin } from './functions'
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
    return () => {
      unsubscribe()
    }
  }, [])

  const userId = authUser?.uid ?? null


  const {
    preferredCurrency,
    loading: currencyLoading,
    setPreferredCurrency,
    availableCurrencies,
  } = useUserPrefs(userId)


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
        if (!active) {
          return
        }
        const allowed = result.data?.allowed ?? false
        setFxAdminState(allowed ? 'allowed' : 'denied')
      })
      .catch(() => {
        if (active) {
          setFxAdminState('denied')
        }
      })

    return () => {
      active = false
    }
  }, [authUser, userEmail])

  useEffect(() => {
    if (isHealthRoute || !authUser) {
      return
    }
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



  const renderFxAdminSection = () => {
    if (authLoading || fxAdminState === 'checking') {
      return (
        <FxAdminPlaceholder
          title={fxAdminTitle}
          message={t('settings.preferences.fxRatesAdmin.checking', '正在確認管理權限…')}
        />
      )
    }

    if (!authUser) {
      return (
        <FxAdminPlaceholder
          title={fxAdminTitle}
          message={t('settings.preferences.fxRatesAdmin.loginPrompt', '請先登入以維護匯率。')}
        />
      )
    }

    if (fxAdminState !== 'allowed') {
      return (
        <FxAdminPlaceholder
          title={fxAdminTitle}
          message={t('settings.preferences.fxRatesAdmin.noPermission', '您沒有維護匯率的權限。')}
        />
      )
    }

    return (
      <SettingsFxAdmin
        rates={rates}
        active={ratesActive}
        effectiveDate={ratesEffectiveDate}
        source={ratesSource}
        updatedAt={ratesUpdatedAt}
        loading={ratesLoading}
      />
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 text-slate-100">
      {import.meta.env.DEV && <DiagBadge preferredCurrency={preferredCurrency} />}
      <header className="rounded border border-slate-800 bg-slate-900/40 p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('app.title')}</h1>
            <p className="mt-2 text-sm text-slate-400">{t('app.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <AuthButton user={authUser} loading={authLoading} />
          </div>
        </div>
      </header>



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

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <TransactionForm userId={userId} />
        <TransactionList userId={userId} preferredCurrency={preferredCurrency} rates={rates} />
      </section>



      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <NotificationCenter userId={userId} />
        <div className="space-y-6">
          <SettingsPreferences
            preferredCurrency={preferredCurrency}
            availableCurrencies={availableCurrencies}
            setPreferredCurrency={setPreferredCurrency}
            currencyLoading={currencyLoading || ratesLoading}
          />
          <SettingsNotifications userId={userId} />
          {renderFxAdminSection()}
        </div>
      </section>



      <footer className="text-right text-xs text-slate-500">Build: {buildId}</footer>
    </>
  )

  return (
    <DashboardLayout
      user={authUser}
      authLoading={authLoading}
      isFxAdmin={fxAdminState === 'allowed'}
    >
      {mainContent}
    </DashboardLayout>
  )
}
