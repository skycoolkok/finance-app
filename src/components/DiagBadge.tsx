import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { CurrencyCode } from '../lib/money'
import { buildId } from '../version'

type DiagBadgeProps = {
  preferredCurrency: CurrencyCode
}

function readStoredLanguage(): string {
  if (typeof window === 'undefined') {
    return 'n/a'
  }
  try {
    return window.localStorage.getItem('lang') ?? '(null)'
  } catch {
    return '(error)'
  }
}

export function DiagBadge({ preferredCurrency }: DiagBadgeProps) {
  const { i18n } = useTranslation()
  const [storedLanguage, setStoredLanguage] = useState<string>(() => readStoredLanguage())

  useEffect(() => {
    setStoredLanguage(readStoredLanguage())
  }, [i18n.language])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'lang') {
        setStoredLanguage(readStoredLanguage())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <aside className="pointer-events-none fixed right-4 top-4 z-50 rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 shadow">
      <p>Build: {buildId}</p>
      <p>i18n: {i18n.language}</p>
      <p>localStorage.lang: {storedLanguage}</p>
      <p>preferredCurrency: {preferredCurrency}</p>
    </aside>
  )
}

export default DiagBadge
