import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { authEnabled, useAuthSheet } from './auth'
import { AUTH_TITLES, AuthForm, type AuthMode } from './AuthForm'

/** Log in / sign up pop-up for when an action needs an account (the free vlog is used up, starting Pro). */
export function AuthSheet() {
  const { open, hide, reason } = useAuthSheet()
  const [mode, setMode] = useState<AuthMode>('signup')
  if (!authEnabled) return null
  return (
    <Sheet open={open} title={AUTH_TITLES[mode]} onClose={hide}>
      {reason && mode !== 'forgot' && <p className="-mt-1 mb-5 text-[15px] text-muted">{reason}</p>}
      <AuthForm mode={mode} onMode={setMode} onDone={hide} onLeave={hide} />
    </Sheet>
  )
}
