import { defineSecret } from 'firebase-functions/params'

export const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
export const APP_BASE_URL = defineSecret('APP_BASE_URL')
export const OPEN_PIXEL_URL = defineSecret('OPEN_PIXEL_URL')
export const CLICK_REDIRECT_URL = defineSecret('CLICK_REDIRECT_URL')
export const FX_ADMIN_EMAILS = defineSecret('FX_ADMIN_EMAILS')
