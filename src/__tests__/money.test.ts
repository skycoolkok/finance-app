import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  const scope = globalThis as Record<string, unknown>
  if (typeof scope.__vite_ssr_exportName__ !== 'function') {
    scope.__vite_ssr_exportName__ = (
      target: Record<string, unknown>,
      name: string,
      valueOrGetter: unknown,
    ) => {
      if (!target || typeof target !== 'object') {
        return
      }
      if (!Object.prototype.hasOwnProperty.call(target, name)) {
        if (typeof valueOrGetter === 'function') {
          Object.defineProperty(target, name, {
            enumerable: true,
            get: valueOrGetter as () => unknown,
          })
        } else {
          Object.defineProperty(target, name, { enumerable: true, value: valueOrGetter })
        }
      }
    }
  }
})

import '../lib/money'

type MoneyRegistry = {
  formatCurrency?: typeof import('../lib/money').formatCurrency
}

const registry = ((globalThis as Record<string, unknown>).__financeMoney__ as MoneyRegistry | undefined) ?? undefined

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

  it('applies provided rates for conversion', () => {
    const result = formatCurrency(10000, {
      currency: 'USD',
      lng: 'en',
      rates: { USD: 0.031 },
    })
    expect(result).toBe('$ 310')
  })

  it('defaults to zero decimals for JPY', () => {
    const result = formatCurrency(1234, {
      currency: 'JPY',
      lng: 'zh-TW',
      rates: { JPY: 4.8 },
    })
    expect(result).toBe('¥ 5,923')
  })

  it('falls back to symbol-only change when rate is missing', () => {
    const result = formatCurrency(5000, { currency: 'USD', lng: 'en', rates: {} })
    expect(result).toBe('$ 5,000')
  })
})
