import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check } from 'lucide-react'
import { DEFAULT_LIMITS, GUEST_LIMITS, PRICING, type BillingInterval } from '@shared/plans.ts'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { authEnabled, useAuthSheet, useSession } from '@/features/auth/auth'
import { cn } from '@/lib/cn'
import { SitePage } from './SiteLayout'
import { startCheckout, useAccountStatus } from './billing'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: PRICING.currency }).format(n)
const yearlySaving = Math.round((1 - PRICING.proYearly / (PRICING.proMonthly * 12)) * 100)

export function PricingPage() {
  const session = useSession()
  const navigate = useNavigate()
  const { status } = useAccountStatus(!!session)
  const [interval, setInterval] = useState<BillingInterval>('year')
  const [busy, setBusy] = useState(false)
  const isPro = status?.plan === 'pro'
  const trial = !status?.trialUsed

  const goPro = async () => {
    if (!authEnabled) return
    if (!session) {
      useAuthSheet.getState().show('Sign in first, then start your Pro trial.')
      return
    }
    setBusy(true)
    try {
      await startCheckout(interval)
    } catch (e) {
      toast((e as Error).message, 'error')
      setBusy(false)
    }
  }

  return (
    <SitePage title="Plans" lead="Start free. Go Pro when you make vlogs every day." wide>
      <div role="radiogroup" aria-label="Billing" className="mb-6 inline-flex rounded-full bg-surface p-1">
        {(['month', 'year'] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={interval === i}
            onClick={() => setInterval(i)}
            className={cn('h-10 rounded-full px-4 text-[14px] font-semibold transition', interval === i ? 'bg-white text-ink' : 'text-muted hover:text-fg')}
          >
            {i === 'month' ? 'Monthly' : `Yearly · save ${yearlySaving}%`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Plan
          name="Free"
          price={money(0)}
          per="forever"
          points={[
            `${GUEST_LIMITS.generationsTotal} vlog to try, no account needed`,
            `Signed in: ${DEFAULT_LIMITS.free.generationsPerDay} vlogs and ${DEFAULT_LIMITS.free.revisionsPerDay} AI edits a day`,
            'All templates, voices and editing tools',
            'Exports in full HD, no watermark',
          ]}
          action={
            <Button variant="outline" block onClick={() => navigate('/')}>
              {isPro ? 'Included' : 'Start making'}
            </Button>
          }
        />
        <Plan
          highlight
          name="Pro"
          price={money(interval === 'year' ? PRICING.proYearly : PRICING.proMonthly)}
          per={interval === 'year' ? `a year (${money(PRICING.proYearly / 12)} a month)` : 'a month'}
          points={[
            `${DEFAULT_LIMITS.pro.generationsPerDay} vlogs and ${DEFAULT_LIMITS.pro.revisionsPerDay} AI edits a day`,
            'Everything in Free',
            'Cancel anytime from your account',
          ]}
          action={
            isPro ? (
              <Button block onClick={() => navigate('/account')}>
                You’re on Pro · manage
              </Button>
            ) : (
              <Button variant="ember" block disabled={busy || !authEnabled} onClick={() => void goPro()}>
                {busy ? <Spinner /> : null} {trial ? `Start ${PRICING.trialDays}-day free trial` : 'Go Pro'}
              </Button>
            )
          }
          note={!isPro && trial ? `Free for ${PRICING.trialDays} days, then ${interval === 'year' ? `${money(PRICING.proYearly)} a year` : `${money(PRICING.proMonthly)} a month`}. Cancel before it ends and you won’t be charged.` : undefined}
        />
      </div>

      <p className="mt-6 text-[13px] text-faint">
        Prices in {PRICING.currency}; taxes may apply. Payments are handled by Stripe. By subscribing you agree to the{' '}
        <Link to="/terms" className="underline hover:text-fg">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="underline hover:text-fg">
          Privacy Policy
        </Link>
        .
      </p>
    </SitePage>
  )
}

function Plan(props: { name: string; price: string; per: string; points: string[]; action: React.ReactNode; note?: string; highlight?: boolean }) {
  return (
    <section aria-label={`${props.name} plan`} className={cn('flex flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-6', props.highlight && 'shadow-[inset_0_0_0_1.5px_#ff5a1f]')}>
      <div>
        <h2 className="text-[20px] font-bold">{props.name}</h2>
        <p className="mt-2">
          <span className="tabular text-[36px] leading-none font-extrabold tracking-[-0.03em]">{props.price}</span> <span className="text-muted">{props.per}</span>
        </p>
      </div>
      <ul className="flex-1 space-y-2.5 text-[15px]">
        {props.points.map((p) => (
          <li key={p} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={3} />
            {p}
          </li>
        ))}
      </ul>
      {props.action}
      {props.note && <p className="-mt-2 text-[13px] text-muted">{props.note}</p>}
    </section>
  )
}
