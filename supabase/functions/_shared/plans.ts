// Plans and limits, shared by the app (to show them) and the Edge Functions
// (to enforce them). PLACEHOLDER business decisions: change them here, and the
// prices in Stripe (the app only displays these numbers; Stripe charges).

export type PlanId = 'free' | 'pro'
export type BillingInterval = 'month' | 'year'

export const PRICING = {
  currency: 'USD',
  /** Pro, billed monthly */
  proMonthly: 9.99,
  /** Pro, billed yearly */
  proYearly: 79,
  /** free trial on a first Pro subscription */
  trialDays: 7,
}

/** Daily limits per plan. The functions read env overrides (FREE_/PRO_GENERATIONS_PER_DAY, …). */
export const DEFAULT_LIMITS: Record<PlanId, { generationsPerDay: number; revisionsPerDay: number }> = {
  free: { generationsPerDay: 3, revisionsPerDay: 20 },
  pro: { generationsPerDay: 30, revisionsPerDay: 300 },
}

/** Guests (not signed in): a taste, then sign in. */
export const GUEST_LIMITS = { generationsTotal: 1, revisionsTotal: 5 }

/** What the account function says about the signed-in user. */
export type AccountStatus = {
  email: string
  plan: PlanId
  /** Stripe subscription status ('active', 'trialing', 'past_due', 'canceled', …) or 'none' */
  status: string
  interval?: BillingInterval
  /** ISO date the current period (or trial) ends */
  periodEnd?: string
  cancelAtPeriodEnd: boolean
  /** a first subscription gets the free trial; later ones don't */
  trialUsed: boolean
  usage: { generations: number; revisions: number }
  limits: { generationsPerDay: number; revisionsPerDay: number }
  /** false until Stripe is configured on the server */
  paymentsEnabled: boolean
}

export type AccountRequest =
  | { action: 'status' }
  | { action: 'checkout'; interval: BillingInterval; returnUrl: string }
  | { action: 'portal'; returnUrl: string }
  | { action: 'delete' }

/** Subscription statuses that unlock Pro (past_due keeps it while Stripe retries the card). */
export const PRO_STATUSES = ['active', 'trialing', 'past_due']
