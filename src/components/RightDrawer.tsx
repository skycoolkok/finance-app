import { useEffect, useMemo, useState, type ReactNode } from 'react'

type DrawerTabKey = 'preferences' | 'notifications' | 'admin'

type RightDrawerProps = {
  open: boolean
  onClose: () => void
  showAdminTab?: boolean
  children?: ReactNode
}

export function RightDrawer({ open, onClose, showAdminTab = false, children }: RightDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTabKey>('preferences')

  const tabs = useMemo(() => {
    const baseTabs: Array<{ key: DrawerTabKey; label: string }> = [
      { key: 'preferences', label: 'Preferences' },
      { key: 'notifications', label: 'Notifications' },
    ]
    if (showAdminTab) {
      baseTabs.push({ key: 'admin', label: 'Admin' })
    }
    return baseTabs
  }, [showAdminTab])

  useEffect(() => {
    if (!open) {
      setActiveTab('preferences')
    } else if (activeTab === 'admin' && !showAdminTab) {
      setActiveTab('preferences')
    }
  }, [open, showAdminTab, activeTab])

  if (!open) {
    return null
  }

  const renderTabContent = () => {
    if (activeTab === 'preferences') {
      return (
        <>
          <p className="text-sm text-slate-300">偏好設定的內容即將在此提供。敬請期待後續更新。</p>
          {children ? <div className="mt-4">{children}</div> : null}
        </>
      )
    }
    if (activeTab === 'notifications') {
      return (
        <p className="text-sm text-slate-300">
          通知測試工具將搬遷到這裡，讓你更輕鬆地發送測試推播與電子郵件。
        </p>
      )
    }
    return (
      <p className="text-sm text-slate-300">管理員工具會集中在這個分頁。僅限具備權限的帳號使用。</p>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="關閉設定面板"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition hover:bg-slate-950/70"
        onClick={onClose}
      />
      <aside
        id="settings-drawer"
        className="relative h-full w-full max-w-md border-l border-slate-800 bg-slate-950 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold">設定</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-200 transition hover:bg-slate-800/60"
          >
            關閉
          </button>
        </div>
        <div className="flex border-b border-slate-800">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'border-b-2 border-emerald-400 bg-slate-900 text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-900/60'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="space-y-4 p-6">{renderTabContent()}</div>
      </aside>
    </div>
  )
}

export default RightDrawer
