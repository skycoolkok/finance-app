type SettingsButtonProps = {
  onClick: () => void
  isOpen: boolean
}

export function SettingsButton({ onClick, isOpen }: SettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
      aria-expanded={isOpen}
      aria-controls="settings-drawer"
    >
      {isOpen ? 'Close Settings' : 'Open Settings'}
    </button>
  )
}

export default SettingsButton
