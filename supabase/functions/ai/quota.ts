import { createClient } from 'npm:@supabase/supabase-js@2.117.0'

export class AuthError extends Error {}
export class QuotaError extends Error {}

/** What a request costs against the caller's limits. */
export type UsageKind = 'generation' | 'revision' | 'call'

const num = (name: string, fallback: number) => Number(Deno.env.get(name) ?? fallback)

// Limits are environment variables so they can change without a deploy.
const LIMITS = {
  userGenerationsPerDay: () => num('USER_GENERATIONS_PER_DAY', 10),
  userRevisionsPerDay: () => num('USER_REVISIONS_PER_DAY', 60),
  guestGenerationsTotal: () => num('GUEST_GENERATIONS_TOTAL', 1),
  guestRevisionsTotal: () => num('GUEST_REVISIONS_TOTAL', 5),
  ipGuestGenerationsPerDay: () => num('IP_GUEST_GENERATIONS_PER_DAY', 3),
  callsPerDay: () => num('CALLS_PER_DAY', 500),
}

/** The slice of the database schema this function uses. */
type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: {
      bump_ai_usage: { Args: { p_subject: string; p_day: string; p_field: string; p_limit: number }; Returns: boolean }
    }
  }
}

let admin: ReturnType<typeof createClient<Database>> | null = null
const db = () => (admin ??= createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } }))

const today = () => new Date().toISOString().slice(0, 10)
const LIFETIME = '1970-01-01'

async function bump(subject: string, day: string, field: 'generations' | 'revisions' | 'calls', limit: number): Promise<boolean> {
  const { data, error } = await db().rpc('bump_ai_usage', { p_subject: subject, p_day: day, p_field: field, p_limit: limit })
  if (error) throw new Error(`usage check failed: ${error.message}`)
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
    if (!(await bump(s, today(), 'calls', LIMITS.callsPerDay()))) throw new QuotaError("You've reached today's limit. Try again tomorrow.")
    if (kind === 'generation' && !(await bump(s, today(), 'generations', LIMITS.userGenerationsPerDay())))
      throw new QuotaError(`You've made ${LIMITS.userGenerationsPerDay()} vlogs today, the daily limit. Try again tomorrow.`)
    if (kind === 'revision' && !(await bump(s, today(), 'revisions', LIMITS.userRevisionsPerDay())))
      throw new QuotaError("You've used today's AI edits. Try again tomorrow.")
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
