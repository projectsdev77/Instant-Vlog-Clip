import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { authEnabled, sendLink, signInWithGoogle, useAuthSheet } from './auth'

// Google is on unless turned off for a build that has no Google sign-in set up.
const googleEnabled = import.meta.env.VITE_AUTH_GOOGLE !== 'false'
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** Seconds before another email can be sent. */
const RESEND_WAIT = 60

type Step = 'email' | 'sent'

export function AuthSheet() {
  const { open, hide, reason } = useAuthSheet()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<'send' | 'google' | null>(null)
  const [error, setError] = useState('')
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  if (!authEnabled) return null

  const close = () => {
    hide()
    setStep('email')
    setError('')
  }

  const send = async () => {
    if (!EMAIL.test(email.trim())) return setError('That doesn’t look like an email address.')
    setBusy('send')
    setError('')
    try {
      await sendLink(email.trim())
      setStep('sent')
      setWait(RESEND_WAIT)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const google = async () => {
    setBusy('google')
    setError('')
    try {
      await signInWithGoogle()
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  const legal = (
    <p className="text-center text-[12px] text-faint">
      By continuing you agree to the{' '}
      <Link to="/terms" onClick={close} className="underline hover:text-fg">
        Terms
      </Link>{' '}
      and{' '}
      <Link to="/privacy" onClick={close} className="underline hover:text-fg">
        Privacy Policy
      </Link>
      .
    </p>
  )

  return (
    <Sheet open={open} title={step === 'sent' ? 'Check your email' : 'Sign in to keep going'} onClose={close}>
      {step === 'sent' ? (
        <div className="space-y-5">
          <span className="grid size-14 place-items-center rounded-full bg-[rgb(255_90_31/.14)] text-accent">
            <Mail className="size-6" strokeWidth={2.2} />
          </span>
          <p className="text-[16px] text-muted">
            We sent a sign-in link to <b className="text-fg">{email.trim()}</b>. Open it on this device. It may take a minute to arrive; check spam too.
          </p>
          {error && <p className="text-[14px] font-medium text-danger">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {wait > 0 ? (
              <span className="tabular text-[14px] text-faint">Send it again in {wait}s</span>
            ) : (
              <Button variant="link" size="sm" className="px-0" disabled={busy === 'send'} onClick={() => void send()}>
                {busy === 'send' ? 'Sending…' : 'Send it again'}
              </Button>
            )}
            <Button
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => {
                setStep('email')
                setError('')
              }}
            >
              Use a different email
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[16px] text-muted">{reason ?? 'Guests get one free vlog. Sign in to keep making them.'} Your vlogs are saved to your account, so you can open them anywhere.</p>
          {googleEnabled && (
            <>
              <Button block variant="outline" className="h-14" disabled={!!busy} onClick={() => void google()}>
                {busy === 'google' ? <Spinner /> : <GoogleMark />} Continue with Google
              </Button>
              <div className="flex items-center gap-3 text-[13px] text-faint" aria-hidden>
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <form
            className="space-y-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <TextInput
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              invalid={!!error}
              className="h-14"
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              aria-label="Email"
              aria-invalid={!!error}
            />
            {error && <p className="text-[14px] font-medium text-danger">{error}</p>}
            <Button type="submit" block className="h-14" disabled={!!busy || !email.trim()}>
              {busy === 'send' ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : (
                'Email me a sign-in link'
              )}
            </Button>
          </form>
          {legal}
        </div>
      )}
    </Sheet>
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
