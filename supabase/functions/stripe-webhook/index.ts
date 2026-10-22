// Keeps public.subscriptions in step with Stripe. Stripe calls this with
// signed events; deploy with --no-verify-jwt (Stripe sends no Supabase JWT).
import Stripe from 'npm:stripe@17.7.0'
import { db, stripe } from '../_shared/billing.ts'
import { PRO_STATUSES } from '../_shared/plans.ts'

const crypto = Stripe.createSubtleCryptoProvider()

/** Finds the app user for a Stripe customer: the subscription's metadata, else our table. */
async function userFor(customerId: string, metadataUserId?: string): Promise<string | null> {
  if (metadataUserId) return metadataUserId
  const { data } = await db().from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle()
  return (data as { user_id: string } | null)?.user_id ?? null
}

async function saveSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const userId = await userFor(customerId, sub.metadata?.user_id)
  if (!userId) {
    console.error('webhook: no user for customer', customerId)
    return
  }
  const item = sub.items.data[0]
  // Newer API versions keep the period on the item; older ones on the subscription.
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end
  const row = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    plan: PRO_STATUSES.includes(sub.status) ? 'pro' : 'free',
    billing_interval: item?.price.recurring?.interval === 'year' ? 'year' : 'month',
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    // Once someone has subscribed (trial or paid), later subscriptions get no trial.
    trial_used: true,
    updated_at: new Date().toISOString(),
  }
  const { error } = await db().from('subscriptions').upsert(row as never)
  if (error) throw new Error(`saving subscription failed: ${error.message}`)
}

Deno.serve(async (request) => {
  const s = stripe()
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!s || !secret) return new Response('Payments are not set up', { status: 503 })
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })
  let event: Stripe.Event
  try {
    event = await s.webhooks.constructEventAsync(await request.text(), signature, secret, undefined, crypto)
  } catch (e) {
    console.error('webhook signature check failed', e)
    return new Response('Bad signature', { status: 400 })
  }
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await s.subscriptions.retrieve(typeof session.subscription === 'string' ? session.subscription : session.subscription.id)
          if (!sub.metadata?.user_id && session.client_reference_id) sub.metadata = { ...sub.metadata, user_id: session.client_reference_id }
          await saveSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await saveSubscription(event.data.object)
        break
      default:
        // Other events aren't needed.
        break
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    console.error('webhook', event.type, e)
    // A 500 makes Stripe retry later.
    return new Response('Webhook handling failed', { status: 500 })
  }
})
