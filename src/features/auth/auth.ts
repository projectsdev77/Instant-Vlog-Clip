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
  if (e?.code === 'invalid_credentials' || /invalid login credentials/i.test(m)) return 'Wrong email or password.'
  if (e?.code === 'email_not_confirmed' || /email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you.'
  if (e?.code === 'user_already_exists' || /already registered/i.test(m)) return 'There’s already an account with this email. Log in instead.'
  if (e?.code === 'weak_password' || /password should|weak password/i.test(m)) return 'Choose a longer password (at least 8 characters).'
  if (e?.code === 'same_password' || /different from the old/i.test(m)) return 'Choose a password you haven’t used before.'
  if (e?.status === 429 || /rate limit|security purposes|too many/i.test(m)) return 'Too many emails were asked for. Wait a minute, then try again.'
  if (/provider is not enabled|unsupported provider/i.test(m)) return 'Google sign-in isn’t available right now. Use your email instead.'
  if (/fetch|network/i.test(m)) return 'Can’t connect. Check your internet and try again.'
  if (m) console.error('Sign-in error (hidden from the user):', m)
  return fallback
}

const fail = (error: Parameters<typeof authMessage>[0], fallback: string) => {
  if (error) throw new Error(authMessage(error, fallback))
}

/** Logs in with email and password. */
export async function logIn(email: string, password: string) {
  const { error } = await supabase!.auth.signInWithPassword({ email, password })
  fail(error, 'Couldn’t log in. Please try again.')
}

/**
 * Creates an account. The user gets an email with a confirmation link that
 * brings them back to `returnTo`, signed in.
 */
export async function signUp(email: string, password: string, returnTo = window.location.href) {
  const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: returnTo } })
  fail(error, 'Couldn’t create the account. Please try again.')
  // An address that already has an account comes back with no identities (no email is sent).
  if (data.user && data.user.identities?.length === 0) throw new Error('There’s already an account with this email. Log in instead.')
}

/** Sends the confirmation email again. */
export async function resendConfirmation(email: string, returnTo = window.location.href) {
  const { error } = await supabase!.auth.resend({ type: 'signup', email, options: { emailRedirectTo: returnTo } })
  fail(error, 'Couldn’t send the email. Please try again.')
}

/** Emails a link to choose a new password (it opens /reset-password). */
export async function sendPasswordReset(email: string) {
  const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
  fail(error, 'Couldn’t send the email. Please try again.')
}

/** Sets a new password for the signed-in user (after following a reset link). */
export async function setNewPassword(password: string) {
  const { error } = await supabase!.auth.updateUser({ password })
  fail(error, 'Couldn’t change the password. Please try again.')
}

export async function signInWithGoogle(returnTo = window.location.href) {
  const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo } })
  fail(error, 'Google sign-in didn’t work. Use your email instead.')
}

export async function signOut() {
  await supabase?.auth.signOut()
}
