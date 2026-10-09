import { useState } from 'react'
import { Mail } from 'lucide-react'
import { PrivacyLine } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { authEnabled, signInWithEmail, signInWithGoogle, useAuthSheet } from './auth'

const googleEnabled = import.meta.env.VITE_AUTH_GOOGLE === 'true'
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function AuthSheet() {
  const { open, hide } = useAuthSheet()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'enter' | 'sending' | 'sent' | 'error'>('enter')
  const [error, setError] = useState('')
  if (!authEnabled) return null

  const send = async () => {
    if (!EMAIL.test(email.trim())) {
      setError('That doesn’t look like an email address.')
      setState('error')
      return
    }
    setState('sending')
    try {
      await signInWithEmail(email.trim())
      setState('sent')
    } catch (e) {
      setError((e as Error).message)
      setState('error')
    }
  }

  return (
    <Sheet open={open} title={state === 'sent' ? 'Check your email' : 'Sign in to keep going'} onClose={hide}>
      {state === 'sent' ? (
        <div className="space-y-5">
          <span className="grid size-14 place-items-center rounded-full bg-[rgb(255_90_31/.14)] text-accent">
            <Mail className="size-6" strokeWidth={2.2} />
          </span>
          <p className="text-[16px] text-muted">
            We sent a sign-in link to <b className="text-fg">{email}</b>. Open it on this device.
          </p>
          <Button variant="link" size="sm" className="px-0" onClick={() => setState('enter')}>
            Use a different email
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[16px] text-muted">Guests get one free vlog. Sign in with your email to keep making them. Your videos still stay on this device.</p>
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
              invalid={state === 'error'}
              className="h-14"
              onChange={(e) => {
                setEmail(e.target.value)
                if (state === 'error') setState('enter')
              }}
              aria-label="Email"
              aria-invalid={state === 'error'}
            />
            {state === 'error' && <p className="text-[14px] font-medium text-danger">{error}</p>}
            <Button type="submit" block className="h-14" disabled={state === 'sending' || !email.trim()}>
              {state === 'sending' ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : (
                'Send sign-in link'
              )}
            </Button>
          </form>
          {googleEnabled && (
            <Button block variant="outline" className="h-14" onClick={() => void signInWithGoogle()}>
              Continue with Google
            </Button>
          )}
          <PrivacyLine className="justify-center text-[13px]" />
        </div>
      )}
    </Sheet>
  )
}
