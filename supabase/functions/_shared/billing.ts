import { createClient } from 'npm:@supabase/supabase-js@2.117.0'
import Stripe from 'npm:stripe@17.7.0'
import { DEFAULT_LIMITS, PRO_STATUSES, type PlanId } from './plans.ts'

/** Service-role database client (bypasses RLS; server only). */
let admin: ReturnType<typeof createClient> | null = null
export const db = () => (admin ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } }))

const num = (name: string, fallback: number) => Number(Deno.env.get(name) ?? fallback)

/** Daily limits for a plan; env vars override the defaults without a deploy. */
export function limitsFor(plan: PlanId) {
  const d = DEFAULT_LIMITS[plan]
  // USER_* were the names before plans existed; they still set the free limits.
  return plan === 'pro'
    ? { generationsPerDay: num('PRO_GENERATIONS_PER_DAY', d.generationsPerDay), revisionsPerDay: num('PRO_REVISIONS_PER_DAY', d.revisionsPerDay) }
    : {
        generationsPerDay: num('FREE_GENERATIONS_PER_DAY', num('USER_GENERATIONS_PER_DAY', d.generationsPerDay)),
        revisionsPerDay: num('FREE_REVISIONS_PER_DAY', num('USER_REVISIONS_PER_DAY', d.revisionsPerDay)),
      }
}

export type SubscriptionRow = {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string
  plan: PlanId
  billing_interval: 'month' | 'year' | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_used: boolean
}

export async function subscriptionOf(userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await db().from('subscriptions').select('*').eq('user_id', userId).maybeSingle()
  if (error) console.error('reading subscriptions failed', error)
  return (data as SubscriptionRow | null) ?? null
}

/** The user's plan; anything but an active (or trialing / retrying) Pro subscription is Free. */
export async function planOf(userId: string): Promise<PlanId> {
  const sub = await subscriptionOf(userId)
  return sub?.plan === 'pro' && PRO_STATUSES.includes(sub.status) ? 'pro' : 'free'
}

/** Stripe, when STRIPE_SECRET_KEY is set; null means payments aren't set up yet. */
let stripeClient: Stripe | null | undefined
export function stripe(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  stripeClient = key ? new Stripe(key, { httpClient: Stripe.createFetchHttpClient() }) : null
  return stripeClient
}

export const today = () => new Date().toISOString().slice(0, 10)
