import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null when Supabase isn’t configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY); AI and sign-in then don’t work. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null
export const supabaseUrl = url
export const supabaseAnonKey = anonKey
