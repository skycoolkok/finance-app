import { useState } from 'react'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
  type AuthProvider,
} from 'firebase/auth'

import { auth } from '../firebase'

type AuthButtonProps = {
  user: User | null
  loading?: boolean
}

function createProvider(): AuthProvider {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({
    prompt: 'select_account',
  })
  return provider
}

export function AuthButton({ user, loading = false }: AuthButtonProps) {
  const [pending, setPending] = useState(false)
  const busy = loading || pending

  const handleSignIn = async () => {
    setPending(true)
    try {
      await signInWithPopup(auth, createProvider())
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Google sign-in failed', error)
      }
    } finally {
      setPending(false)
    }
  }

  const handleSignOut = async () => {
    setPending(true)
    try {
      await signOut(auth)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Sign-out failed', error)
      }
    } finally {
      setPending(false)
    }
  }

  if (user) {
    return (
      <div className="flex items-center gap-3 rounded border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-100">
        <span className="truncate">{user.email ?? user.displayName ?? '已登入'}</span>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="rounded border border-slate-600 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? '登出中…' : '登出'}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={busy}
      className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
    >
      {pending ? '登入中…' : '用 Google 登入'}
    </button>
  )
}

export default AuthButton
