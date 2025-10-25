import { createHash } from 'node:crypto'

export type AbVariant = 'A' | 'B'

type AssignInput = {
  userId: string
  eventKey: string
  channel?: 'push' | 'email'
}

export function assignVariant(input: AssignInput): AbVariant {
  const key = `${input.userId}:${input.eventKey}:${input.channel ?? 'email'}`
  const hash = createHash('sha256').update(key).digest()
  return hash[0] % 2 === 0 ? 'A' : 'B'
}
