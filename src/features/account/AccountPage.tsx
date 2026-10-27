import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { DEFAULT_LIMITS, PRICING } from '@shared/plans.ts'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import { authEnabled, signOut, useAuthSheet, useSession } from '@/features/auth/auth'
import { db } from '@/lib/db'
import { deleteProject } from '@/store/projectStore'
import { SitePage } from './SiteLayout'
import { deleteAccount, openBillingPortal, useAccountStatus } from './billing'
import { refreshAccount, useCloud } from '@/cloud/autoSync'
import { formatBytes } from '@/lib/format'

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '')

export function AccountPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { status, error, refresh } = useAccountStatus(!!session)
  const [busy, setBusy] = useState<string | null>(null)
  const space = useCloud((s) => s.space)
  const signedInId = useCloud((s) => s.userId)
  useEffect(() => {
    if (signedInId) void refreshAccount()
  }, [signedInId])

  // Back from Stripe Checkout: the webhook can take a moment, so check again a few times.
  const polls = useRef(0)
  const checkout = params.get('checkout')
  useEffect(() => {
    if (checkout !== 'success') return
    toast('Welcome to Pro! It can take a few seconds to show here.', 'success')
    const t = window.setInterval(() => {
      if (++polls.current > 8) window.clearInterval(t)
      refresh()
    }, 2500)
    setParams((p) => {
      p.delete('checkout')
      return p
    })
    return () => window.clearInterval(t)
  }, [checkout, refresh, setParams])

  if (!authEnabled) return <SitePage title="Account">Accounts aren’t available in this build.</SitePage>
  if (!session)
    return (
      <SitePage title="Account" lead="Sign in to see your plan and usage.">
        <Button onClick={() => useAuthSheet.getState().show()}>Sign in</Button>
      </SitePage>
    )

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const pro = status?.plan === 'pro'
  const planLine = !status
    ? ''
    : status.status === 'trialing'
      ? `Free trial until ${day(status.periodEnd)}${status.cancelAtPeriodEnd ? ', then it ends' : `, then ${status.interval === 'year' ? 'yearly' : 'monthly'} billing starts`}.`
      : status.status === 'past_due'
        ? 'Your last payment didn’t go through. Update your card to keep Pro.'
        : pro && status.cancelAtPeriodEnd
          ? `Pro until ${day(status.periodEnd)}, then back to Free.`
          : pro
            ? `Renews ${day(status.periodEnd)}, billed ${status.interval === 'year' ? 'yearly' : 'monthly'}.`
            : `Pro makes ${DEFAULT_LIMITS.pro.generationsPerDay} vlogs a day instead of ${status.limits.generationsPerDay}, from ${new Intl.NumberFormat('en-US', { style: 'currency', currency: PRICING.currency }).format(PRICING.proMonthly)} a month.`

  return (
    <SitePage title="Account" lead={session.user.email}>
      {error && <p className="mb-6 text-[15px] text-[#ff8a8a]">Couldn’t load your plan ({error}).</p>}
      <div className="space-y-4">
        <section aria-labelledby="plan-h" className="space-y-4 rounded-[var(--radius-panel)] bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="plan-h" className="text-[20px] font-bold">
              {status ? (pro ? 'Pro' : 'Free') : <Spinner />} <span className="text-[15px] font-medium text-muted">plan</span>
            </h2>
            {status &&
              (status.status !== 'none' ? (
                <Button size="sm" variant="quiet" disabled={!!busy} onClick={() => void run('portal', openBillingPortal)}>
                  {busy === 'portal' ? <Spinner /> : null} Manage billing
                </Button>
              ) : (
                <Button size="sm" variant="ember" onClick={() => navigate('/pricing')}>
                  See Pro
                </Button>
              ))}
          </div>
          {status && <p className="text-[15px] text-muted">{planLine}</p>}
          {status && !status.paymentsEnabled && !pro && <p className="text-[13px] text-faint">Payments aren’t switched on yet.</p>}
        </section>

        {status && (
          <section aria-labelledby="usage-h" className="space-y-4 rounded-[var(--radius-panel)] bg-surface p-6">
            <h2 id="usage-h" className="text-[17px] font-bold">
              Today
            </h2>
            <Usage label="Vlogs made" used={status.usage.generations} limit={status.limits.generationsPerDay} />
            <Usage label="AI edits (Ask AI)" used={status.usage.revisions} limit={status.limits.revisionsPerDay} />
            <p className="text-[13px] text-faint">Limits reset at midnight UTC.</p>
          </section>
        )}

        {space && (
          <section aria-labelledby="space-h" className="space-y-3 rounded-[var(--radius-panel)] bg-surface p-6">
            <h2 id="space-h" className="text-[17px] font-bold">
              Account space
            </h2>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[14px]">
                <span>Your vlogs</span>
                <span className="tabular text-muted">
                  {formatBytes(space.used)} of {formatBytes(space.limit)}
                </span>
              </div>
              <Progress value={Math.min(1, space.used / Math.max(1, space.limit))} />
            </div>
            <p className="text-[13px] text-faint">
              {space.used >= space.limit
                ? 'Your space is full. New finished videos stay on this device until you delete old vlogs on Home' + (pro ? '.' : ' or go Pro for more space.')
                : 'Deleting a vlog frees its space.'}
            </p>
          </section>
        )}

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-surface p-6">
          <p className="text-[15px] text-muted">Signed in as {session.user.email}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void signOut().then(() => {
                navigate('/')
              })
            }
          >
            Sign out
          </Button>
        </section>

        <DeleteAccount
          pro={pro}
          busy={busy === 'delete'}
          onDelete={(alsoVlogs) =>
            run('delete', async () => {
              await deleteAccount()
              if (alsoVlogs) for (const p of await db.projects.toArray()) await deleteProject(p.id)
              await signOut()
              toast('Your account is deleted.', 'success')
              navigate('/')
            })
          }
        />
      </div>
      <p className="mt-8 text-[13px] text-faint">
        See the{' '}
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

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[14px]">
        <span>{label}</span>
        <span className="tabular text-muted">
          {used} of {limit}
        </span>
      </div>
      <Progress value={Math.min(1, used / Math.max(1, limit))} />
    </div>
  )
}

/** Deleting the account: say what goes, confirm by typing DELETE. */
function DeleteAccount({ pro, busy, onDelete }: { pro: boolean; busy: boolean; onDelete: (alsoVlogs: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [alsoVlogs, setAlsoVlogs] = useState(false)
  return (
    <section aria-labelledby="delete-h" className="space-y-3 rounded-[var(--radius-panel)] p-6 shadow-[inset_0_0_0_1px_rgb(255_79_79/.35)]">
      <h2 id="delete-h" className="text-[17px] font-bold">
        Delete account
      </h2>
      <p className="text-[14px] text-muted">
        Removes your account, the vlogs and videos saved in it, and your usage history{pro ? ', and cancels Pro right away with no refund for the time left' : ''}. Copies on this device stay unless you tick the box below.
      </p>
      {open ? (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 text-[14px]">
            <input type="checkbox" checked={alsoVlogs} onChange={(e) => setAlsoVlogs(e.target.checked)} className="size-4 accent-[#ff5a1f]" />
            Also delete the vlogs on this device
          </label>
          <label htmlFor="confirm-delete" className="block text-[14px]">
            Type DELETE to confirm
          </label>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[200px] flex-1">
              <TextInput id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
            <Button variant="danger" disabled={typed !== 'DELETE' || busy} onClick={() => onDelete(alsoVlogs)}>
              {busy ? <Spinner /> : null} Delete my account
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="text" className="text-danger" onClick={() => setOpen(true)}>
          Delete account…
        </Button>
      )}
    </section>
  )
}
