import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from 'firebase/auth'

import AuthButton from '../components/AuthButton'
import LanguageSwitcher from '../components/LanguageSwitcher'
import SettingsButton from '../components/SettingsButton'
import { RightDrawer } from '../components/RightDrawer'

type DashboardLayoutProps = {
  user: User | null
  authLoading: boolean
  children: ReactNode
  sidebar?: ReactNode
  drawerContent?: ReactNode
}

export function DashboardLayout({
  user,
  authLoading,
  children,
  sidebar,
  drawerContent,
}: DashboardLayoutProps) {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('app.title')}</h1>
            <p className="text-sm text-slate-400">{t('app.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            <AuthButton user={user} loading={authLoading} />
            <SettingsButton onClick={() => setDrawerOpen(true)} isOpen={drawerOpen} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className={`grid gap-6 ${sidebar ? 'lg:grid-cols-12' : ''}`}>
          <div className={`col-span-12 flex flex-col gap-6 ${sidebar ? 'lg:col-span-8' : ''}`}>
            {children}
          </div>
          {sidebar ? (
            <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">{sidebar}</div>
          ) : null}
        </div>
      </main>

      <RightDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {drawerContent}
      </RightDrawer>
    </div>
  )
}

export default DashboardLayout
