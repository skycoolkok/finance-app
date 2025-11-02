import { Resend } from 'resend'
import { memo } from './lib/lazy'
import { RESEND_API_KEY } from './params'

export class MissingResendApiKeyError extends Error {
  constructor() {
    super('RESEND_API_KEY is not configured')
    this.name = 'MissingResendApiKeyError'
  }
}

const getResendInternal = memo((): Resend => {
  const apiKey = RESEND_API_KEY.value()
  if (!apiKey) {
    throw new MissingResendApiKeyError()
  }

  return new Resend(apiKey)
})

export async function getResendClient(): Promise<Resend> {
  return getResendInternal()
}

export async function getResendClientOrNull(): Promise<Resend | null> {
  try {
    return await getResendClient()
  } catch (error) {
    if (error instanceof MissingResendApiKeyError) {
      return null
    }
    throw error
  }
}
