export interface Card {
  id: string
  alias: string
  issuer: string
  last4: string
  statementDay: number
  dueDay: number
  limitAmount: number
  userId: string
}

export interface Wallet {
  id: string
  name: string
  linkedCardId?: string | null
  isDefault: boolean
  note?: string | null
  userId: string
}

export interface Transaction {
  id: string
  date: string
  amount: number
  merchant: string
  category: string
  sourceType: 'card' | 'wallet'
  sourceId: string
  affectCurrentBill: boolean
  cardId?: string | null
  note?: string
  userId: string
}

export interface Budget {
  id: string
  userId: string
  category: string
  limit: number
  period: string
  startDate: string
  endDate: string
  spent: number
}
