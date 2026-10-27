import { Link, useLocation, useNavigate } from 'react-router'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { authEnabled, useSession } from './auth'

export function AccountButton() {
  const session = useSession()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (!authEnabled) return null
  if (!session) {
    const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`
    return (
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="text" className="h-10" onClick={() => navigate(`/login${next}`)}>
          Log in
        </Button>
        <Button size="sm" className="h-10" onClick={() => navigate(`/signup${next}`)}>
          Sign up
        </Button>
      </div>
    )
  }
  return (
    <Link to="/settings" className="flex h-10 items-center gap-2 rounded-full bg-black/28 px-3.5 text-[13px] font-semibold hover:bg-black/40" title={session.user.email ?? undefined}>
      <UserRound className="size-4" strokeWidth={2.4} />
      <span className="hidden max-w-40 truncate sm:inline">{session.user.email}</span>
      <span className="sm:hidden">Account</span>
    </Link>
  )
}
