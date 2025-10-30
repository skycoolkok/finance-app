import { Resend } from 'resend'
import { RESEND_API_KEY } from './params'

let cachedClient: Resend | null = null
let cachedKey: string | null = null

export class MissingResendApiKeyError extends Error {
  constructor() {
    super('RESEND_API_KEY is not configured')
    this.name = 'MissingResendApiKeyError'
  }
}

export async function getResendClient(): Promise<Resend> {
  const apiKey = RESEND_API_KEY.value()
  if (!apiKey) {
    throw new MissingResendApiKeyError()
  }

  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Resend(apiKey)
    cachedKey = apiKey
  }

  return cachedClient
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
