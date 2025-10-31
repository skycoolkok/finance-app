import { defineSecret } from 'firebase-functions/params'

const OPEN_PIXEL_URL_PARAM = defineSecret('OPEN_PIXEL_URL')

export const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
export const APP_BASE_URL = defineSecret('APP_BASE_URL')
export const CLICK_REDIRECT_URL = defineSecret('CLICK_REDIRECT_URL')
export const FX_ADMIN_EMAILS = defineSecret('FX_ADMIN_EMAILS')

export function getOpenPixelUrl(): string | undefined {
  try {
    const value = OPEN_PIXEL_URL_PARAM.value()
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  } catch {
    // Secret not set; fall back to environment variable.
  }

  const envValue = process.env.OPEN_PIXEL_URL?.trim()
  return envValue && envValue.length > 0 ? envValue : undefined
}
