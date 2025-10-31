import { defineSecret } from 'firebase-functions/params'

import { memo } from './lib/lazy'

const IS_DEPLOY_PHASE = process.env.FUNCTIONS_CONTROL_API === 'true'

const APP_BASE_URL_PARAM = IS_DEPLOY_PHASE ? undefined : defineSecret('APP_BASE_URL')
const OPEN_PIXEL_URL_PARAM = IS_DEPLOY_PHASE ? undefined : defineSecret('OPEN_PIXEL_URL')
const CLICK_REDIRECT_URL_PARAM = IS_DEPLOY_PHASE ? undefined : defineSecret('CLICK_REDIRECT_URL')

export const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
export const FX_ADMIN_EMAILS = defineSecret('FX_ADMIN_EMAILS')

const DEFAULT_BASE_URL = 'https://finance-app.local'

const readBaseUrl = memo((): string => {
  const secretValue = readOptionalSecret(APP_BASE_URL_PARAM)
  if (secretValue) {
    return secretValue
  }

  const envValue = process.env.APP_BASE_URL?.trim()
  if (envValue && envValue.length > 0) {
    return envValue
  }

  return DEFAULT_BASE_URL
})

export function getBaseUrl(): string {
  return readBaseUrl()
}

export function getOpenPixelUrl(): string | undefined {
  const secretValue = readOptionalSecret(OPEN_PIXEL_URL_PARAM)
  if (secretValue) {
    return secretValue
  }

  const envValue = process.env.OPEN_PIXEL_URL?.trim()
  return envValue && envValue.length > 0 ? envValue : undefined
}

export function getClickRedirectUrl(): string | undefined {
  const secretValue = readOptionalSecret(CLICK_REDIRECT_URL_PARAM)
  if (secretValue) {
    return secretValue
  }

  const envValue = process.env.CLICK_REDIRECT_URL?.trim()
  return envValue && envValue.length > 0 ? envValue : undefined
}

function readOptionalSecret(param: ReturnType<typeof defineSecret> | undefined): string | undefined {
  if (!param) {
    return undefined
  }

  try {
    const value = param.value()
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : undefined
    }
  } catch {
    // Access during deploy or secret missing; fall back to env/default.
  }
  return undefined
}
