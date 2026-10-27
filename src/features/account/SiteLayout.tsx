import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { LogoTile, Wordmark } from '@/components/Brand'
import { AccountButton } from '@/features/auth/AccountButton'
import { cn } from '@/lib/cn'

/** Links every page offers at the bottom: plans and the legal pages. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-[14px] text-muted md:px-10', className)}>
      <span>© {new Date().getFullYear()} Instant Vlog Clip</span>
      <nav aria-label="Site" className="flex flex-wrap gap-x-5 gap-y-2">
        <Link to="/pricing" className="hover:text-fg">
          Pricing
        </Link>
        <Link to="/terms" className="hover:text-fg">
          Terms
        </Link>
        <Link to="/privacy" className="hover:text-fg">
          Privacy
        </Link>
      </nav>
    </footer>
  )
}

/** Logo home and the account button, on every page outside the vlog flow. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-10 md:pt-7">
      <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-xl" aria-label="Instant Vlog Clip home">
        <LogoTile />
        <Wordmark />
      </Link>
      <AccountButton />
    </header>
  )
}

/** A plain page outside the vlog flow (pricing, legal). */
export function SitePage({ title, lead, children, wide }: { title: string; lead?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className={cn('mx-auto w-full flex-1 px-4 pt-10 pb-16 md:px-10 md:pt-14', wide ? 'max-w-[1120px]' : 'max-w-[760px]')}>
        <h1 className="title-1 text-balance">{title}</h1>
        {lead && <div className="mt-3 max-w-[62ch] text-[17px] text-muted">{lead}</div>}
        <div className="mt-8">{children}</div>
      </main>
      <SiteFooter className="border-t border-border" />
    </div>
  )
}
