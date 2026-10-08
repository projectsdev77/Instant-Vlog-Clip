import { LogOut, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { authEnabled, signOut, useAuthSheet, useSession } from './auth'

export function AccountButton() {
  const session = useSession()
  const show = useAuthSheet((s) => s.show)
  if (!authEnabled) return null
  if (!session)
    return (
      <Button size="sm" variant="secondary" onClick={() => show()}>
        <UserRound className="size-4" /> Sign in
      </Button>
    )
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="hidden max-w-40 truncate sm:inline">{session.user.email}</span>
      <Button size="sm" variant="ghost" onClick={() => void signOut()} aria-label="Sign out">
        <LogOut className="size-4" />
      </Button>
    </div>
  )
}
