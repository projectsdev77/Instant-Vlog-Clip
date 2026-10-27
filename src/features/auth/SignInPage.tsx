import { useEffect } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { LogoTile, Wordmark } from '@/components/Brand'
import { authEnabled, useSession } from './auth'
import { SignInForm } from './SignInForm'

/** /signin?next=/somewhere: sign in or create an account, then go back. */
export function SignInPage() {
  const session = useSession()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'
  useEffect(() => {
    document.title = 'Sign in · Instant Vlog Clip'
  }, [])
  if (!authEnabled || session) return <Navigate to={next} replace />
  return (
    <div className="relative flex min-h-dvh flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-10 md:pt-7">
      <div className="ember-wash -z-10" aria-hidden />
      <Link to="/" className="flex w-fit items-center gap-2.5">
        <LogoTile />
        <Wordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center pb-24">
        <h1 className="mb-7 text-[30px] leading-tight font-extrabold tracking-[-0.03em]">Sign in</h1>
        <SignInForm returnTo={`${window.location.origin}${next}`} />
      </main>
    </div>
  )
}
