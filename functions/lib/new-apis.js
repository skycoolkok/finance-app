'use strict'
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        var desc = Object.getOwnPropertyDescriptor(m, k)
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k]
            },
          }
        }
        Object.defineProperty(o, k2, desc)
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v })
      }
    : function (o, v) {
        o['default'] = v
      })
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = []
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k
          return ar
        }
      return ownKeys(o)
    }
    return function (mod) {
      if (mod && mod.__esModule) return mod
      var result = {}
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i])
      __setModuleDefault(result, mod)
      return result
    }
  })()
Object.defineProperty(exports, '__esModule', { value: true })
exports.registerToken = exports.sendTestPush = exports.ping = void 0
const admin = __importStar(require('firebase-admin'))
const https_1 = require('firebase-functions/v2/https')
const options_1 = require('firebase-functions/v2/options')
const firebase_functions_1 = require('firebase-functions')
const resend_1 = require('resend')
const lazy_1 = require('./lib/lazy')
const params_1 = require('./params')
const REGION = 'asia-east1'
;(0, options_1.setGlobalOptions)({
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
})
if (!admin.apps.length) {
  admin.initializeApp()
}
const getFirestore = (0, lazy_1.memo)(() => admin.firestore())
const getMessaging = (0, lazy_1.memo)(() => admin.messaging())
const getResend = (0, lazy_1.memo)(() => {
  const key = params_1.RESEND_API_KEY.value()
  if (!key) {
    firebase_functions_1.logger.warn('RESEND_API_KEY not set. Email notifications will be skipped.')
    throw new Error('RESEND_API_KEY not configured')
  }
  return new resend_1.Resend(key)
})
const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000
exports.ping = (0, https_1.onCall)(
  { region: REGION, secrets: [params_1.RESEND_API_KEY] },
  async (request) => {
    let resendReady = true
    try {
      getResend()
    } catch {
      resendReady = false
    }
    return {
      ok: true,
      echo: request.data ?? null,
      env: {
        emulator: process.env.FUNCTIONS_EMULATOR === 'true',
        projectId: process.env.GCLOUD_PROJECT,
        region: REGION,
        resendReady,
      },
    }
  },
)
exports.sendTestPush = (0, https_1.onCall)(
  { region: REGION, secrets: [params_1.RESEND_API_KEY] },
  async ({ data }) => {
    const userId = (data?.userId ?? '').toString().trim()
    if (!userId) {
      throw new Error('missing userId')
    }
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      return { mocked: true, sent: true, userId, note: 'Emulator mock response' }
    }
    await getMessaging().send({
      topic: `user_${userId}`,
      notification: { title: 'Hello', body: 'This is a test push' },
    })
    return { mocked: false, sent: true, userId }
  },
)
exports.registerToken = (0, https_1.onCall)(
  { region: REGION, secrets: [params_1.RESEND_API_KEY] },
  async (request) => {
    const token = (request.data?.token ?? '').toString().trim()
    const userId = (request.data?.userId ?? request.auth?.uid ?? '').toString().trim() || null
    if (!token) {
      throw new Error('missing token')
    }
    await getFirestore().collection('pushTokens').doc(token).set(
      {
        uid: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        windowMs: NOTIFICATION_WINDOW_MS,
      },
      { merge: true },
    )
    try {
      getResend()
    } catch (error) {
      firebase_functions_1.logger.debug(
        'Resend client unavailable during registerToken invocation',
        { error },
      )
    }
    return { ok: true, token, userId }
  },
)
