import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, useNavigate, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, CreditCard, HardDrive, ShieldCheck, SlidersHorizontal, UserRound, type LucideIcon } from 'lucide-react'
import { DEFAULT_LIMITS, PRICING } from '@shared/plans.ts'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import { refreshAccount, useCloud } from '@/cloud/autoSync'
import { clearDevice, isMine } from '@/cloud/sync'
import { authEnabled, changeEmail, signOut, signOutEverywhere, useSession, useSessionReady } from '@/features/auth/auth'
import { useTutorial } from '@/features/tutorial/tutorial'
import { db } from '@/lib/db'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { downloadAllBackups } from '@/pipeline/backup'
import { deleteProject } from '@/store/projectStore'
import type { AccountStatus } from '@shared/plans.ts'
import { deleteAccount, openBillingPortal, useAccountStatus } from './billing'
import { PasswordSection } from './PasswordSection'
import { SiteFooter, SiteHeader } from './SiteLayout'

type SectionId = 'account' | 'plan' | 'storage' | 'preferences' | 'data'

const SECTIONS: { id: SectionId; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'account', label: 'Account', hint: 'Email, password, log out', icon: UserRound },
  { id: 'plan', label: 'Plan & usage', hint: 'Your plan, billing, today’s limits', icon: CreditCard },
  { id: 'storage', label: 'Storage', hint: 'Space your vlogs use', icon: HardDrive },
  { id: 'preferences', label: 'Preferences', hint: 'Tips and help', icon: SlidersHorizontal },
  { id: 'data', label: 'Data & privacy', hint: 'Download, clear, delete account', icon: ShieldCheck },
]

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '')

/** /settings and /settings/:section. Computer: menu on the left. Phone: a list, then one section with a back arrow. */
export function SettingsPage() {
  const session = useSession()
  const ready = useSessionReady()
  const { section } = useParams()
  const desktop = useMediaQuery('(min-width: 768px)')
  const status = useAccountStatus(!!session)
  const signedInId = useCloud((s) => s.userId)
  useEffect(() => {
    if (signedInId) void refreshAccount()
  }, [signedInId])
  useEffect(() => {
    document.title = 'Settings · Instant Vlog Clip'
  }, [])

  if (!authEnabled) return <Shell>Accounts aren’t available in this build.</Shell>
  if (!ready) return <Shell>{null}</Shell>
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(`/settings${section ? `/${section}` : ''}`)}`} replace />
  const current = SECTIONS.find((s) => s.id === section)
  if (section && !current) return <Navigate to="/settings" replace />
  if (desktop && !current) return <Navigate to="/settings/account" replace />

  const body = current && <Section id={current.id} status={status} email={session.user.email ?? ''} user={session.user} />

  if (!desktop)
    return (
      <Shell>
        {current ? (
          <>
            <Link to="/settings" className="-ml-1 mb-4 flex w-fit items-center gap-1 text-[15px] font-semibold text-muted hover:text-fg">
              <ChevronLeft className="size-5" strokeWidth={2.4} /> Settings
            </Link>
            <h1 className="mb-6 text-[28px] font-extrabold tracking-[-0.03em]">{current.label}</h1>
            {body}
          </>
        ) : (
          <>
            <h1 className="mb-6 text-[30px] font-extrabold tracking-[-0.03em]">Settings</h1>
            <p className="mb-4 truncate text-[14px] text-muted">{session.user.email}</p>
            <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface">
              {SECTIONS.map((s) => (
                <li key={s.id} className="border-t border-border first:border-t-0">
                  <Link to={`/settings/${s.id}`} className="flex items-center gap-3.5 px-4 py-4 hover:bg-white/4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
                      <s.icon className="size-[18px]" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold">{s.label}</span>
                      <span className="block truncate text-[13px] text-muted">{s.hint}</span>
                    </span>
                    <ChevronRight className="size-5 text-faint" strokeWidth={2.2} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Shell>
    )

  return (
    <Shell wide>
      <h1 className="mb-8 text-[34px] font-extrabold tracking-[-0.03em]">Settings</h1>
      <div className="grid grid-cols-[230px_minmax(0,1fr)] gap-10">
        <nav aria-label="Settings" className="sticky top-6 self-start">
          <p className="mb-3 truncate px-3 text-[13px] text-muted" title={session.user.email ?? undefined}>
            {session.user.email}
          </p>
          <ul className="space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <NavLink
                  to={`/settings/${s.id}`}
                  className={({ isActive }) => cn('flex h-11 items-center gap-3 rounded-full px-3.5 text-[15px] font-semibold transition', isActive ? 'bg-white text-ink' : 'text-white/75 hover:bg-white/6 hover:text-fg')}
                >
                  <s.icon className="size-[18px]" strokeWidth={2.2} /> {s.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <h2 className="mb-1 text-[24px] font-bold">{current!.label}</h2>
          <p className="mb-6 text-[15px] text-muted">{current!.hint}</p>
          {body}
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className={cn('mx-auto w-full flex-1 px-4 pt-8 pb-16 md:px-10 md:pt-12', wide ? 'max-w-[1120px]' : 'max-w-[640px]')}>{children}</main>
      <SiteFooter className="border-t border-border" />
    </div>
  )
}

/** A white-on-dark group inside a section. */
function Card({ title, children, danger }: { title?: string; children: ReactNode; danger?: boolean }) {
  return (
    <section aria-label={title} className={cn('space-y-4 rounded-[var(--radius-panel)] p-6', danger ? 'shadow-[inset_0_0_0_1px_rgb(255_79_79/.35)]' : 'bg-surface')}>
      {title && <h3 className="text-[17px] font-bold">{title}</h3>}
      {children}
    </section>
  )
}

type Props = { status: ReturnType<typeof useAccountStatus>; email: string; user: NonNullable<ReturnType<typeof useSession>>['user'] }

function Section({ id, ...props }: Props & { id: SectionId }) {
  return <div className="space-y-4">{id === 'account' ? <AccountSection {...props} /> : id === 'plan' ? <PlanSection {...props} /> : id === 'storage' ? <StorageSection /> : id === 'preferences' ? <PreferencesSection /> : <DataSection {...props} />}</div>
}

function AccountSection({ email, user }: Props) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState<'email' | 'all' | null>(null)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  const save = async () => {
    const e = next.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return setError('Enter a valid email address.')
    if (e.toLowerCase() === email.toLowerCase()) return setError('That’s already your email.')
    setBusy('email')
    setError('')
    try {
      await changeEmail(e)
      setSentTo(e)
      setEditing(false)
      setNext('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Card title="Email">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[15px]">{email}</p>
          {!editing && (
            <Button size="sm" variant="quiet" onClick={() => setEditing(true)}>
              Change email
            </Button>
          )}
        </div>
        {sentTo && !editing && (
          <p role="status" className="text-[14px] text-muted">
            We sent a confirmation link to <b className="text-fg">{sentTo}</b>. Your email changes once you open it.
          </p>
        )}
        {editing && (
          <form
            className="space-y-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-[13px] font-semibold text-muted">New email</span>
              <TextInput type="email" autoComplete="email" value={next} autoFocus onChange={(e) => (setNext(e.target.value), setError(''))} aria-label="New email" />
            </label>
            {error && (
              <p role="alert" className="text-[14px] font-medium text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!!busy}>
                {busy === 'email' && <Spinner />} Send confirmation link
              </Button>
              <Button size="sm" variant="text" onClick={() => (setEditing(false), setError(''))}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>

      <PasswordSection user={user} />

      <Card title="Log out">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void signOut().then(() => navigate('/'))}>
            Log out
          </Button>
          <Button
            size="sm"
            variant="text"
            disabled={!!busy}
            onClick={() => {
              setBusy('all')
              void signOutEverywhere().then(() => {
                toast('Logged out on all your devices.', 'success')
                navigate('/')
              })
            }}
          >
            {busy === 'all' && <Spinner />} Log out everywhere
          </Button>
        </div>
        <p className="text-[13px] text-faint">“Log out everywhere” also logs you out on other phones and computers.</p>
      </Card>
    </>
  )
}

function PlanSection({ status: { status, error, refresh } }: Props) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)

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

  if (error) return <p className="text-[15px] text-danger">Couldn’t load your plan. Try again in a moment.</p>
  if (!status) return <Spinner />
  const pro = status.plan === 'pro'
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[20px] font-bold">
            {pro ? 'Pro' : 'Free'} <span className="text-[15px] font-medium text-muted">plan</span>
          </h3>
          {status.status !== 'none' ? (
            <Button
              size="sm"
              variant="quiet"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void openBillingPortal()
                  .catch((e: Error) => toast(e.message, 'error'))
                  .finally(() => setBusy(false))
              }}
            >
              {busy && <Spinner />} Manage billing
            </Button>
          ) : (
            <Button size="sm" variant="ember" onClick={() => navigate('/pricing')}>
              See Pro
            </Button>
          )}
        </div>
        <p className="text-[15px] text-muted">{planLine(status)}</p>
        {!status.paymentsEnabled && !pro && <p className="text-[13px] text-faint">Payments aren’t switched on yet.</p>}
      </Card>
      <Card title="Today">
        <Usage label="Vlogs made" used={status.usage.generations} limit={status.limits.generationsPerDay} />
        <Usage label="AI edits (Ask AI)" used={status.usage.revisions} limit={status.limits.revisionsPerDay} />
        <p className="text-[13px] text-faint">Limits reset at midnight UTC.</p>
      </Card>
    </>
  )
}

function planLine(status: AccountStatus): string {
  const pro = status.plan === 'pro'
  if (status.status === 'trialing') return `Free trial until ${day(status.periodEnd)}${status.cancelAtPeriodEnd ? ', then it ends' : `, then ${status.interval === 'year' ? 'yearly' : 'monthly'} billing starts`}.`
  if (status.status === 'past_due') return 'Your last payment didn’t go through. Update your card to keep Pro.'
  if (pro && status.cancelAtPeriodEnd) return `Pro until ${day(status.periodEnd)}, then back to Free.`
  if (pro) return `Renews ${day(status.periodEnd)}, billed ${status.interval === 'year' ? 'yearly' : 'monthly'}.`
  return `Pro makes ${DEFAULT_LIMITS.pro.generationsPerDay} vlogs a day instead of ${status.limits.generationsPerDay}, from ${new Intl.NumberFormat('en-US', { style: 'currency', currency: PRICING.currency }).format(PRICING.proMonthly)} a month.`
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

function StorageSection() {
  const space = useCloud((s) => s.space)
  if (!space) return <Spinner />
  const full = space.used >= space.limit
  return (
    <Card title="Account space">
      <div className="space-y-1.5">
        <div className="flex justify-between text-[14px]">
          <span>Your vlogs</span>
          <span className="tabular text-muted">
            {formatBytes(space.used)} of {formatBytes(space.limit)}
          </span>
        </div>
        <Progress value={Math.min(1, space.used / Math.max(1, space.limit))} />
      </div>
      <p className="text-[13px] text-faint">{full ? `Your space is full. Delete old vlogs on Home${space.plan === 'pro' ? '' : ' or go Pro'} to save new videos.` : 'Deleting a vlog frees its space.'}</p>
      <Link to="/" className="inline-block text-[14px] font-semibold text-ember-300 hover:text-ember-200">
        Manage vlogs on Home
      </Link>
    </Card>
  )
}

function PreferencesSection() {
  const navigate = useNavigate()
  const start = useTutorial((s) => s.start)
  return (
    <Card title="Tips">
      <p className="text-[14px] text-muted">The tips that point out each control as you make a vlog.</p>
      <Button
        size="sm"
        variant="quiet"
        onClick={() => {
          start()
          toast('Tips are back on.', 'success')
          navigate('/')
        }}
      >
        Show the tips again
      </Button>
    </Card>
  )
}

function DataSection({ status: { status } }: Props) {
  const navigate = useNavigate()
  const userId = useCloud((s) => s.userId)
  const [busy, setBusy] = useState<'download' | 'clear' | 'delete' | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const download = async () => {
    setBusy('download')
    try {
      const ids = (await db.projects.toArray()).filter((p) => userId && isMine(p, userId) && p.clipIds.length).map((p) => p.id)
      if (!ids.length) return toast('There are no vlogs on this device to download.', 'info')
      const n = await downloadAllBackups(ids)
      toast(`Downloaded ${n} backup${n === 1 ? '' : 's'}.`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const clear = async () => {
    setBusy('clear')
    try {
      const { removed, kept } = await clearDevice(deleteProject)
      toast(`${removed ? `Removed ${removed} vlog${removed === 1 ? '' : 's'} from this device.` : 'Nothing to remove.'}${kept ? ` ${kept} not saved to your account yet stayed.` : ''}`, 'success')
      setConfirmClear(false)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Card title="Download my vlogs">
        <p className="text-[14px] text-muted">A backup file for each vlog on this device, with its clips, recordings and edits. Open one later with “Open a backup” on Home.</p>
        <Button size="sm" variant="quiet" disabled={!!busy} onClick={() => void download()}>
          {busy === 'download' && <Spinner />} Download all
        </Button>
      </Card>
      <Card title="Clear this device">
        <p className="text-[14px] text-muted">Removes your vlogs from this device. They stay in your account; to edit one here again, you’ll add its clips again.</p>
        {confirmClear ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="danger" disabled={!!busy} onClick={() => void clear()}>
              {busy === 'clear' && <Spinner />} Remove from this device
            </Button>
            <Button size="sm" variant="text" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="quiet" onClick={() => setConfirmClear(true)}>
            Clear this device
          </Button>
        )}
      </Card>
      <DeleteAccount
        pro={status?.plan === 'pro'}
        busy={busy === 'delete'}
        onDelete={(alsoVlogs) => {
          setBusy('delete')
          void (async () => {
            try {
              await deleteAccount()
              if (alsoVlogs) for (const p of await db.projects.toArray()) await deleteProject(p.id)
              await signOut()
              toast('Your account is deleted.', 'success')
              navigate('/')
            } catch (e) {
              toast((e as Error).message, 'error')
              setBusy(null)
            }
          })()
        }}
      />
    </>
  )
}

/** Deleting the account: say what goes, confirm by typing DELETE. */
function DeleteAccount({ pro, busy, onDelete }: { pro: boolean; busy: boolean; onDelete: (alsoVlogs: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [alsoVlogs, setAlsoVlogs] = useState(false)
  return (
    <Card title="Delete account" danger>
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
    </Card>
  )
}
