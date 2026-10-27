import { Sheet } from '@/components/ui/Sheet'
import { authEnabled, useAuthSheet } from './auth'
import { SignInForm } from './SignInForm'

/** Sign-in pop-up for when an action needs an account (the free vlog is used up, starting Pro). */
export function AuthSheet() {
  const { open, hide, reason } = useAuthSheet()
  if (!authEnabled) return null
  return (
    <Sheet open={open} title="Sign in" onClose={hide}>
      {reason && <p className="-mt-1 mb-5 text-[15px] text-muted">{reason}</p>}
      <SignInForm onLeave={hide} />
    </Sheet>
  )
}
