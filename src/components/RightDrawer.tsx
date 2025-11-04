import { useEffect, useState, type ReactNode } from 'react'

type DrawerTabKey = 'preferences' | 'notifications' | 'admin'

type RightDrawerProps = {
  open: boolean
  onClose: () => void
  children?: ReactNode
}

const TAB_CONFIG: Array<{ key: DrawerTabKey; label: string; description: string }> = [
  {
    key: 'preferences',
    label: 'Preferences',
    description:
      'Account preferences will live here. Expect currency, locale, and other personalization controls.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description:
      'Notification delivery settings and test tools will move into this tab. Stay tuned for granular controls.',
  },
  {
    key: 'admin',
    label: 'Admin',
    description:
      'FX admin and rollout toggles will appear here for authorized users. This is just a placeholder for now.',
  },
]

export function RightDrawer({ open, onClose, children }: RightDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTabKey>('preferences')

  useEffect(() => {
    if (!open) {
      setActiveTab('preferences')
    }
  }, [open])

  if (!open) {
    return null
  }

  const activeTabConfig = TAB_CONFIG.find((tab) => tab.key === activeTab) ?? TAB_CONFIG[0]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close settings drawer"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition hover:bg-slate-950/70"
        onClick={onClose}
      />
      <aside
        id="settings-drawer"
        className="relative h-full w-full max-w-md border-l border-slate-800 bg-slate-950 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-200 transition hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Close
          </button>
        </div>

        <nav className="flex border-b border-slate-800">
          {TAB_CONFIG.map((tab) => {
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
        </nav>

        <div className="space-y-4 px-6 py-6">
          <p className="text-sm leading-relaxed text-slate-300">{activeTabConfig.description}</p>
          {children ? <div className="rounded border border-slate-800 p-4">{children}</div> : null}
        </div>
      </aside>
    </div>
  )
}

export default RightDrawer
