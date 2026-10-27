import { useCallback, useEffect, useState } from 'react'
import type { AccountRequest, AccountStatus, BillingInterval } from '@shared/plans.ts'
import { supabase } from '@/lib/supabase'

/** Calls the account Edge Function as the signed-in user. */
async function call<T>(req: AccountRequest): Promise<T> {
  if (!supabase) throw new Error('Accounts aren’t available in this build.')
  const { data, error } = await supabase.functions.invoke('account', { body: req })
  if (error) {
    let message = 'Something went wrong. Please try again.'
    try {
      const body = (await (error as { context?: Response }).context?.json()) as { error?: string } | undefined
      if (body?.error) message = body.error
    } catch {
      /* keep the generic message */
    }
    throw new Error(message)
  }
  return data as T
}

export const accountStatus = () => call<AccountStatus>({ action: 'status' })

/** Sends the browser to Stripe Checkout for Pro. */
export async function startCheckout(interval: BillingInterval) {
  const { url } = await call<{ url: string }>({ action: 'checkout', interval, returnUrl: `${location.origin}/settings/plan` })
  location.assign(url)
}

/** Sends the browser to Stripe's billing portal (change plan, card, cancel, invoices). */
export async function openBillingPortal() {
  const { url } = await call<{ url: string }>({ action: 'portal', returnUrl: `${location.origin}/settings/plan` })
  location.assign(url)
}

export const deleteAccount = () => call<{ deleted: boolean }>({ action: 'delete' })

/** The signed-in user's plan and usage; `refresh` reads it again (e.g. after checkout). */
export function useAccountStatus(signedIn: boolean) {
  const [status, setStatus] = useState<AccountStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!signedIn) return
    let alive = true
    accountStatus().then(
      (s) => {
        if (!alive) return
        setStatus(s)
        setError(null)
      },
      (e: Error) => alive && setError(e.message),
    )
    return () => {
      alive = false
    }
  }, [signedIn, nonce])
  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  return { status: signedIn ? status : null, error, refresh }
}
