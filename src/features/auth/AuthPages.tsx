import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { LogoTile, Wordmark } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { authEnabled, setNewPassword, useSession } from './auth'
import { AUTH_TITLES, AuthForm, type AuthMode } from './AuthForm'
import { PasswordRules, passwordOk } from './password'

function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Instant Vlog Clip`
  }, [title])
  return (
    <div className="relative flex min-h-dvh flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-10 md:pt-7">
      <div className="ember-wash -z-10" aria-hidden />
      <Link to="/" className="flex w-fit items-center gap-2.5">
        <LogoTile />
        <Wordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
        <h1 className="mb-7 text-[30px] leading-tight font-extrabold tracking-[-0.03em]">{title}</h1>
        {children}
      </main>
    </div>
  )
}

/** /login and /signup (?next=/somewhere): the same form, switching between the two. */
export function AuthPage({ initial }: { initial: 'login' | 'signup' }) {
  const session = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'
  const [mode, setMode] = useState<AuthMode>(initial)
  if (!authEnabled || session) return <Navigate to={next} replace />
  const switchTo = (m: AuthMode) => {
    setMode(m)
    if (m !== 'forgot') navigate(`/${m}${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true })
  }
  return (
    <AuthLayout title={AUTH_TITLES[mode]}>
      <AuthForm key={initial} mode={mode} onMode={switchTo} returnTo={`${window.location.origin}${next}`} onDone={() => navigate(next, { replace: true })} />
    </AuthLayout>
  )
}

/** Opened from the "choose a new password" email: the link signs the user in for this one step. */
export function ResetPasswordPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    // Give the link's sign-in a moment to land before saying it expired.
    const t = setTimeout(() => setChecked(true), 1500)
    void supabase?.auth.getSession().then(({ data }) => data.session && setChecked(true))
    return () => clearTimeout(t)
  }, [])

  const save = async () => {
    if (!passwordOk(password)) return setError('Your password doesn’t meet all the requirements yet.')
    setBusy(true)
    setError('')
    try {
      await setNewPassword(password)
      toast('Your password is changed.', 'success')
      navigate('/', { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!session)
    return (
      <AuthLayout title="Choose a new password">
        {checked ? (
          <div className="space-y-4">
            <p className="text-[15px] text-muted">This link has expired or was already used.</p>
            <Button block className="h-14" onClick={() => navigate('/login')}>
              Back to log in
            </Button>
          </div>
        ) : (
          <Spinner />
        )}
      </AuthLayout>
    )
  return (
    <AuthLayout title="Choose a new password">
      <form
        className="space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="relative">
          <TextInput
            autoFocus
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            className="h-14 pr-14"
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
            aria-label="New password"
          />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg">
            {show ? <EyeOff className="size-5" strokeWidth={2.2} /> : <Eye className="size-5" strokeWidth={2.2} />}
          </button>
        </div>
        <PasswordRules password={password} />
        {error && (
          <p role="alert" className="text-[14px] font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" block className="h-14" disabled={busy}>
          {busy && <Spinner />} Save password
        </Button>
      </form>
    </AuthLayout>
  )
}
