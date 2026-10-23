import { db, limitsFor, planOf, today } from '../_server/billing.ts'
import { GUEST_LIMITS } from '../_shared/plans.ts'

export class AuthError extends Error {}
/** The server is missing setup (database migration). */
export class SetupError extends Error {}

export class QuotaError extends Error {}

/** What a request costs against the caller's limits. */
export type UsageKind = 'generation' | 'revision' | 'call'

const num = (name: string, fallback: number) => Number(Deno.env.get(name) ?? fallback)

// Limits are environment variables so they can change without a deploy.
// Signed-in users' daily limits depend on their plan (see _shared/billing.ts).
const LIMITS = {
  guestGenerationsTotal: () => num('GUEST_GENERATIONS_TOTAL', GUEST_LIMITS.generationsTotal),
  guestRevisionsTotal: () => num('GUEST_REVISIONS_TOTAL', GUEST_LIMITS.revisionsTotal),
  ipGuestGenerationsPerDay: () => num('IP_GUEST_GENERATIONS_PER_DAY', 3),
  callsPerDay: () => num('CALLS_PER_DAY', 500),
}

const LIFETIME = '1970-01-01'

async function bump(subject: string, day: string, field: 'generations' | 'revisions' | 'calls', limit: number): Promise<boolean> {
  const { data, error } = await db().rpc('bump_ai_usage', { p_subject: subject, p_day: day, p_field: field, p_limit: limit } as never)
  if (error) {
    console.error('bump_ai_usage failed', error)
    throw new SetupError('Usage limits are not set up: run `supabase db push` (or set QUOTAS_DISABLED=true while developing).')
  }
  return data === true
}

/**
 * Identifies the caller (signed-in user, or guest by device id + IP) and
 * enforces limits. Set QUOTAS_DISABLED=true to skip (local development).
 */
export async function authorize(req: Request, kind: UsageKind): Promise<void> {
  if (Deno.env.get('QUOTAS_DISABLED') === 'true') return
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new AuthError('Missing credentials')

  const { data } = await db().auth.getUser(token)
  const user = data?.user
  if (user) {
    const s = `user:${user.id}`
    const plan = await planOf(user.id)
    const limits = limitsFor(plan)
    // Free users who hit a limit are offered Pro (the app shows "See Pro" for these messages).
    const more = plan === 'free' ? ' Go Pro for more, or try again tomorrow.' : ' Try again tomorrow.'
    if (!(await bump(s, today(), 'calls', LIMITS.callsPerDay()))) throw new QuotaError(`You've reached today's limit.${more}`)
    if (kind === 'generation' && !(await bump(s, today(), 'generations', limits.generationsPerDay)))
      throw new QuotaError(`You've made ${limits.generationsPerDay} vlogs today, the daily limit.${more}`)
    if (kind === 'revision' && !(await bump(s, today(), 'revisions', limits.revisionsPerDay))) throw new QuotaError(`You've used today's AI edits.${more}`)
    return
  }

  const guest = req.headers.get('x-guest-id')
  if (!guest || guest.length > 64) throw new AuthError('Sign in to use AI features.')
  const g = `guest:${guest}`
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!(await bump(g, today(), 'calls', LIMITS.callsPerDay()))) throw new QuotaError('Sign in to keep using AI features.')
  if (kind === 'generation') {
    if (!(await bump(`ip:${ip}`, today(), 'generations', LIMITS.ipGuestGenerationsPerDay())) || !(await bump(g, LIFETIME, 'generations', LIMITS.guestGenerationsTotal())))
      throw new QuotaError("You've used your free vlog. Sign in to make more.")
  }
  if (kind === 'revision' && !(await bump(g, LIFETIME, 'revisions', LIMITS.guestRevisionsTotal())))
    throw new QuotaError('Sign in to keep editing with AI.')
}
