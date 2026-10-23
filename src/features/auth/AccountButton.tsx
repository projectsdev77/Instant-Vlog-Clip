import { Link } from 'react-router'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { authEnabled, useAuthSheet, useSession } from './auth'

export function AccountButton() {
  const session = useSession()
  const show = useAuthSheet((s) => s.show)
  if (!authEnabled) return null
  if (!session)
    return (
      <Button size="sm" className="h-10" onClick={() => show()}>
        Sign in
      </Button>
    )
  return (
    <Link to="/account" className="flex h-10 items-center gap-2 rounded-full bg-black/28 px-3.5 text-[13px] font-semibold hover:bg-black/40" title={session.user.email ?? undefined}>
      <UserRound className="size-4" strokeWidth={2.4} />
      <span className="hidden max-w-40 truncate sm:inline">{session.user.email}</span>
      <span className="sm:hidden">Account</span>
    </Link>
  )
}
