import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from 'firebase/auth'

import AuthButton from '../components/AuthButton'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { RightDrawer } from '../components/RightDrawer'

type DashboardLayoutProps = {
  user: User | null
  authLoading: boolean
  children: ReactNode
  sidebar?: ReactNode
  isFxAdmin?: boolean
}

export function DashboardLayout({
  user,
  authLoading,
  children,
  sidebar,
  isFxAdmin = false,
}: DashboardLayoutProps) {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const hasSidebar = Boolean(sidebar)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('app.title')}</h1>
            <p className="text-sm text-slate-400">{t('app.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            <AuthButton user={user} loading={authLoading} />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60"
              aria-expanded={drawerOpen}
              aria-controls="settings-drawer"
            >
              設定
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div
          className={`grid gap-6 ${hasSidebar ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}
        >
          <div className="flex flex-col gap-6">{children}</div>
          {hasSidebar ? <div className="flex flex-col gap-6">{sidebar}</div> : null}
        </div>
      </main>

      <RightDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        showAdminTab={isFxAdmin}
      />
    </div>
  )
}

export default DashboardLayout
