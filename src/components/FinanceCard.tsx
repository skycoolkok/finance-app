import { useTranslation } from 'react-i18next'

export function FinanceCard() {
  const { t } = useTranslation()

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-lg backdrop-blur">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
        {t('app.hero.title')}
      </h1>
      <p className="mt-3 text-sm text-slate-400">{t('app.hero.subtitle')}</p>
    </section>
  )
}
