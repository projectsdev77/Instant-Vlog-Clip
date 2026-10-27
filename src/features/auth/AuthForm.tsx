import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { logIn, resendConfirmation, sendPasswordReset, signInWithGoogle, signUp } from './auth'

// Google is on unless turned off for a build that has no Google sign-in set up.
const googleEnabled = import.meta.env.VITE_AUTH_GOOGLE !== 'false'
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MIN_PASSWORD = 8
/** Seconds before an email can be sent again. */
const RESEND_WAIT = 60

export type AuthMode = 'login' | 'signup' | 'forgot'

export const AUTH_TITLES: Record<AuthMode, string> = { login: 'Log in', signup: 'Create your account', forgot: 'Reset your password' }

type Props = {
  mode: AuthMode
  onMode: (m: AuthMode) => void
  /** where links in emails and Google bring the user back to */
  returnTo?: string
  /** after logging in */
  onDone?: () => void
  /** following a link out of the form (Terms, Privacy) */
  onLeave?: () => void
}

/** Log in, sign up (confirmed by email) or reset a password; Google for the first two. */
export function AuthForm({ mode, onMode, returnTo, onDone, onLeave }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<'submit' | 'google' | 'resend' | null>(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<'confirm' | 'reset' | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const go = (m: AuthMode) => {
    setError('')
    setSent(null)
    onMode(m)
  }

  const submit = async () => {
    const e = email.trim()
    if (!EMAIL.test(e)) return setError('Enter a valid email address.')
    if (mode !== 'forgot' && !password) return setError('Enter your password.')
    if (mode === 'signup' && password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for your password.`)
    setBusy('submit')
    setError('')
    try {
      if (mode === 'login') {
        await logIn(e, password)
        onDone?.()
      } else if (mode === 'signup') {
        await signUp(e, password, returnTo)
        setSent('confirm')
        setWait(RESEND_WAIT)
      } else {
        await sendPasswordReset(e)
        setSent('reset')
        setWait(RESEND_WAIT)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const resend = async () => {
    setBusy('resend')
    setError('')
    try {
      if (sent === 'confirm') await resendConfirmation(email.trim(), returnTo)
      else await sendPasswordReset(email.trim())
      setWait(RESEND_WAIT)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const google = async () => {
    setBusy('google')
    setError('')
    try {
      await signInWithGoogle(returnTo)
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  if (sent)
    return (
      <div className="space-y-5" data-testid="auth-sent">
        <span className="grid size-14 place-items-center rounded-full bg-[rgb(255_90_31/.14)] text-accent">
          <MailCheck className="size-6" strokeWidth={2.2} />
        </span>
        <p className="text-[16px] text-muted">
          {sent === 'confirm' ? 'We sent a confirmation link to ' : 'We sent a link to choose a new password to '}
          <b className="text-fg">{email.trim()}</b>.
        </p>
        {error && <p className="text-[14px] font-medium text-danger">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {wait > 0 ? (
            <span className="tabular text-[14px] text-faint">Send it again in {wait}s</span>
          ) : (
            <Button variant="link" size="sm" className="px-0" disabled={busy === 'resend'} onClick={() => void resend()}>
              {busy === 'resend' ? 'Sending…' : 'Send it again'}
            </Button>
          )}
          <Button variant="link" size="sm" className="px-0" onClick={() => go('login')}>
            Back to log in
          </Button>
        </div>
      </div>
    )

  return (
    <div className="space-y-4">
      {googleEnabled && mode !== 'forgot' && (
        <>
          <Button block variant="outline" className="h-14" disabled={!!busy} onClick={() => void google()}>
            {busy === 'google' ? <Spinner /> : <GoogleMark />} {mode === 'signup' ? 'Sign up with Google' : 'Log in with Google'}
          </Button>
          <div className="flex items-center gap-3 text-[13px] text-faint" aria-hidden>
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      {mode === 'forgot' && <p className="text-[15px] text-muted">Enter your email and we’ll send you a link to choose a new password.</p>}
      <form
        className="space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <TextInput
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          className="h-14"
          onChange={(e) => {
            setEmail(e.target.value)
            setError('')
          }}
          aria-label="Email"
        />
        {mode !== 'forgot' && (
          <div className="relative">
            <TextInput
              type={show ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? `Password (at least ${MIN_PASSWORD} characters)` : 'Password'}
              value={password}
              className="h-14 pr-14"
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              aria-label="Password"
            />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg">
              {show ? <EyeOff className="size-5" strokeWidth={2.2} /> : <Eye className="size-5" strokeWidth={2.2} />}
            </button>
          </div>
        )}
        {mode === 'login' && (
          <div className="flex justify-end">
            <button type="button" onClick={() => go('forgot')} className="text-[14px] font-semibold text-muted hover:text-fg">
              Forgot password?
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[14px] font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" block className="h-14" disabled={!!busy}>
          {busy === 'submit' && <Spinner />} {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send link'}
        </Button>
      </form>
      <p className="text-center text-[14px] text-muted">
        {mode === 'signup' ? 'Already have an account? ' : mode === 'login' ? 'New here? ' : ''}
        <button type="button" onClick={() => go(mode === 'login' ? 'signup' : 'login')} className="font-bold text-fg underline-offset-2 hover:underline">
          {mode === 'login' ? 'Create an account' : mode === 'signup' ? 'Log in' : 'Back to log in'}
        </button>
      </p>
      {mode === 'signup' && (
        <p className="text-center text-[12px] text-faint">
          By creating an account you agree to the{' '}
          <Link to="/terms" onClick={onLeave} className="underline hover:text-fg">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" onClick={onLeave} className="underline hover:text-fg">
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </div>
  )
}

/** Google's "G", in its colors. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  )
}
