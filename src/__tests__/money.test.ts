import { beforeEach, describe, expect, it } from 'vitest'

import './setup/vite-ssr-export'
import '../lib/money'

type MoneyRegistry = {
  formatCurrency?: typeof import('../lib/money').formatCurrency
}

const registry =
  ((globalThis as Record<string, unknown>).__financeMoney__ as MoneyRegistry | undefined) ??
  undefined

if (!registry || typeof registry.formatCurrency !== 'function') {
  throw new Error('formatCurrency export missing for tests')
}

const formatCurrency = registry.formatCurrency

describe('formatCurrency', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('formats TWD amounts without conversion', () => {
    expect(formatCurrency(1234, { currency: 'TWD', lng: 'en' })).toBe('NT$ 1,234')
  })

  it('applies provided rates for conversion (USD)', () => {
    const result = formatCurrency(10000, {
      currency: 'USD',
      lng: 'en',
      rates: { USD: 0.031 },
    })

    const numericPortion = Number(result.replace(/[^0-9.]/g, ''))
    expect(result.startsWith('$ ')).toBe(true)
    expect(numericPortion).toBeGreaterThan(309)
    expect(numericPortion).toBeLessThan(311)
  })

  it('applies provided rates for conversion (EUR)', () => {
    const result = formatCurrency(10000, {
      currency: 'EUR',
      lng: 'en',
      rates: { EUR: 0.0285 },
    })
    expect(result).toBe('€ 285')
  })

  it('applies provided rates for conversion (GBP)', () => {
    const result = formatCurrency(10000, {
      currency: 'GBP',
      lng: 'en',
      rates: { GBP: 0.024 },
    })
    expect(result).toBe('£ 240')
  })

  it('defaults to zero decimals for JPY', () => {
    const result = formatCurrency(1234, {
      currency: 'JPY',
      lng: 'zh-TW',
      rates: { JPY: 4.8 },
    })
    expect(result).toBe('¥ 5,923')
  })

  it('defaults to zero decimals for KRW', () => {
    const result = formatCurrency(9876.54, {
      currency: 'KRW',
      lng: 'en',
      rates: { KRW: 38.7 },
    })
    expect(result).toBe('₩ 382,222')
  })

  it('falls back to symbol-only change when rate is missing', () => {
    const result = formatCurrency(5000, { currency: 'USD', lng: 'en', rates: {} })
    expect(result).toBe('$ 5,000')
  })
})
