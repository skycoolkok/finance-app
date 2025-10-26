export type CurrencyCode = 'TWD' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'KRW'

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = [
  'TWD',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'KRW',
] as const
