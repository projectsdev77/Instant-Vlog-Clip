import { Button } from '@/components/ui/Button'
import { authEnabled, signOut, useAuthSheet, useSession } from './auth'

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
    <div className="flex items-center gap-1 rounded-full bg-black/28 py-1 pr-1 pl-3.5 text-[13px] font-medium">
      <span className="max-w-40 truncate">{session.user.email}</span>
      <Button size="sm" variant="text" className="h-8 px-3" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  )
}
