import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

/** Sign-in exists only when the app talks to real AI through Supabase. */
export const authEnabled = !!supabase

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

type SheetState = { open: boolean; reason?: string; show: (reason?: string) => void; hide: () => void }

export const useAuthSheet = create<SheetState>((set) => ({
  open: false,
  show: (reason) => set({ open: true, reason }),
  hide: () => set({ open: false, reason: undefined }),
}))

/** "Go Pro" sheet, for signed-in users who hit a daily limit. */
export const useUpgradeSheet = create<SheetState>((set) => ({
  open: false,
  show: (reason) => set({ open: true, reason }),
  hide: () => set({ open: false, reason: undefined }),
}))

/**
 * An AI request was refused for credentials or limits: guests are asked to
 * sign in; signed-in users who hit a limit are offered Pro.
 */
export async function promptForAccess(code: string, message: string) {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  if (code === 'quota' && data.session) useUpgradeSheet.getState().show(message)
  else useAuthSheet.getState().show(message)
}

/** Sign-in errors in plain words (the service's own messages aren't shown to users). */
function authMessage(e: { message?: string; status?: number; code?: string } | null | undefined, fallback: string): string {
  const m = e?.message ?? ''
  if (e?.status === 429 || /rate limit|security purposes|too many/i.test(m)) return 'Too many sign-in emails were asked for. Wait a minute, then try again.'
  if (/provider is not enabled|unsupported provider/i.test(m)) return 'Google sign-in isn’t available right now. Use your email instead.'
  if (/fetch|network/i.test(m)) return 'Can’t connect. Check your internet and try again.'
  if (m) console.error('Sign-in error (hidden from the user):', m)
  return fallback
}

/** Emails a sign-in link that brings the user back to this page, signed in (a new account is made on first sign-in). */
export async function sendLink(email: string) {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: window.location.href } })
  if (error) throw new Error(authMessage(error, 'We couldn’t send the email. Please try again.'))
}

export async function signInWithGoogle() {
  const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })
  if (error) throw new Error(authMessage(error, 'Google sign-in didn’t work. Use your email instead.'))
}

export async function signOut() {
  await supabase?.auth.signOut()
}
