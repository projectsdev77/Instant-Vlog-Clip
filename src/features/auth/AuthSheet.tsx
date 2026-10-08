import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { authEnabled, signInWithEmail, signInWithGoogle, useAuthSheet } from './auth'

const googleEnabled = import.meta.env.VITE_AUTH_GOOGLE === 'true'

export function AuthSheet() {
  const { open, reason, hide } = useAuthSheet()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  if (!authEnabled) return null

  const send = async () => {
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
    <Sheet open={open} title="Sign in" onClose={hide}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{reason ?? 'Sign in to make more vlogs.'} Your videos still stay on this device.</p>
        {state === 'sent' ? (
          <div className="rounded-[var(--radius-card)] bg-surface p-4 text-sm">
            <Mail className="mb-2 size-5 text-accent" />
            Check <b>{email}</b> for a sign-in link. You can close this.
          </div>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <TextInput type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <Button type="submit" block size="lg" disabled={state === 'sending' || !email.includes('@')}>
              {state === 'sending' && <Spinner />} Email me a sign-in link
            </Button>
            {state === 'error' && <p className="text-sm text-danger">{error}</p>}
          </form>
        )}
        {googleEnabled && state !== 'sent' && (
          <Button block variant="secondary" size="lg" onClick={() => void signInWithGoogle()}>
            Continue with Google
          </Button>
        )}
      </div>
    </Sheet>
  )
}
