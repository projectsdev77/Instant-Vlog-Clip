// The signed-in user's account: plan and usage, Stripe checkout and billing
// portal, and deleting the account. Every action needs a signed-in user.
import { db, limitsFor, planOf, stripe, subscriptionOf, today } from '../_server/billing.ts'
import { PRICING, type AccountRequest, type AccountStatus } from '../_shared/plans.ts'

const origin = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
const CORS = {
  'access-control-allow-origin': origin,
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })
const fail = (message: string, status: number) => json({ error: message }, status)

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** Return URLs must point back at the app, never elsewhere (no open redirects). */
function safeReturn(url: string): string {
  try {
    const u = new URL(url)
    if (origin !== '*' && u.origin !== new URL(origin).origin) throw new Error()
    return u.toString()
  } catch {
    throw new HttpError('Bad return address.', 400)
  }
}

async function status(user: { id: string; email?: string }): Promise<AccountStatus> {
  const [sub, plan, usage] = await Promise.all([
    subscriptionOf(user.id),
    planOf(user.id),
    db().from('ai_usage').select('generations, revisions').eq('subject', `user:${user.id}`).eq('day', today()).maybeSingle(),
  ])
  const counts = (usage.data as { generations: number; revisions: number } | null) ?? { generations: 0, revisions: 0 }
  return {
    email: user.email ?? '',
    plan,
    status: sub?.status ?? 'none',
    interval: sub?.billing_interval ?? undefined,
    periodEnd: sub?.current_period_end ?? undefined,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    trialUsed: !!sub?.trial_used,
    usage: { generations: counts.generations, revisions: counts.revisions },
    limits: limitsFor(plan),
    paymentsEnabled: !!stripe() && !!Deno.env.get('STRIPE_PRICE_MONTHLY') && !!Deno.env.get('STRIPE_PRICE_YEARLY'),
  }
}

/** The user's Stripe customer, created (and remembered) on first checkout. */
async function customerFor(user: { id: string; email?: string }): Promise<string> {
  const s = stripe()!
  const sub = await subscriptionOf(user.id)
  if (sub?.stripe_customer_id) return sub.stripe_customer_id
  const customer = await s.customers.create({ email: user.email, metadata: { user_id: user.id } })
  const { error } = await db().from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customer.id, updated_at: new Date().toISOString() } as never)
  if (error) throw new Error(`saving the Stripe customer failed: ${error.message}`)
  return customer.id
}

async function checkout(user: { id: string; email?: string }, interval: 'month' | 'year', returnUrl: string) {
  const s = stripe()
  const price = Deno.env.get(interval === 'year' ? 'STRIPE_PRICE_YEARLY' : 'STRIPE_PRICE_MONTHLY')
  if (!s || !price) throw new HttpError('Payments aren’t set up yet.', 503)
  if ((await planOf(user.id)) === 'pro') throw new HttpError('You’re already on Pro. Manage it from your account.', 409)
  const back = safeReturn(returnUrl)
  const sub = await subscriptionOf(user.id)
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer: await customerFor(user),
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id }, ...(sub?.trial_used ? {} : { trial_period_days: PRICING.trialDays }) },
    allow_promotion_codes: true,
    success_url: `${back}${back.includes('?') ? '&' : '?'}checkout=success`,
    cancel_url: `${back}${back.includes('?') ? '&' : '?'}checkout=cancelled`,
  })
  return { url: session.url }
}

async function portal(user: { id: string }, returnUrl: string) {
  const s = stripe()
  const sub = await subscriptionOf(user.id)
  if (!s || !sub?.stripe_customer_id) throw new HttpError('There’s no billing to manage yet.', 404)
  const session = await s.billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: safeReturn(returnUrl) })
  return { url: session.url }
}

/** Cancels any subscription at once, removes the Stripe customer, usage and the account. */
async function deleteAccount(user: { id: string }) {
  const s = stripe()
  const sub = await subscriptionOf(user.id)
  if (s && sub?.stripe_customer_id) {
    // Deleting the customer also cancels their subscriptions immediately.
    await s.customers.del(sub.stripe_customer_id).catch((e) => console.error('deleting the Stripe customer failed', e))
  }
  await db().from('ai_usage').delete().eq('subject', `user:${user.id}`)
  await db().from('subscriptions').delete().eq('user_id', user.id)
  const { error } = await db().auth.admin.deleteUser(user.id)
  if (error) throw new Error(`deleting the user failed: ${error.message}`)
  return { deleted: true }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return fail('POST only', 405)
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const { data } = token ? await db().auth.getUser(token) : { data: { user: null } }
  const user = data?.user
  if (!user) return fail('Sign in first.', 401)
  let body: AccountRequest
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON', 400)
  }
  try {
    switch (body.action) {
      case 'status':
        return json(await status(user))
      case 'checkout':
        return json(await checkout(user, body.interval === 'year' ? 'year' : 'month', body.returnUrl))
      case 'portal':
        return json(await portal(user, body.returnUrl))
      case 'delete':
        return json(await deleteAccount(user))
      default:
        return fail('Unknown action', 400)
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status)
    console.error('account', body.action, e)
    return fail('Something went wrong. Please try again.', 500)
  }
})
