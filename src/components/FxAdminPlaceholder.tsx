export type FxAdminPlaceholderProps = {
  title: string
  message: string
}

export function FxAdminPlaceholder({ title, message }: FxAdminPlaceholderProps) {
  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-5 shadow">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      </header>
      <p className="text-sm text-slate-400">{message}</p>
    </section>
  )
}

export default FxAdminPlaceholder
