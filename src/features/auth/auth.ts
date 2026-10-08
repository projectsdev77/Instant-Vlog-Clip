import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { aiMode } from '@/ai'
import { supabase } from '@/lib/supabase'

/** Sign-in exists only when the app talks to real AI through Supabase. */
export const authEnabled = aiMode === 'live' && !!supabase

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

export async function signInWithEmail(email: string) {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } })
  if (error) throw error
}

export async function signInWithGoogle() {
  const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
}
