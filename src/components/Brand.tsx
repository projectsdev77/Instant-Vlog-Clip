import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Placeholder mark until branding arrives: white tile, ember film-strip glyph. */
export function LogoTile({ size = 36 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[11px] bg-white" style={{ width: size, height: size }}>
      <svg width={size / 2} height={size / 2} viewBox="0 0 24 24" fill="none" stroke="#e2440d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 4v16M17 4v16M3 8h4M17 8h4M3 12h18M3 16h4M17 16h4" />
        <rect x="3" y="3" width="18" height="18" rx="3" />
      </svg>
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn('text-[17px] font-bold tracking-[-0.01em] whitespace-nowrap', className)}>Instant Vlog Clip</span>
}

export function DemoBadge({ className }: { className?: string }) {
  return <span className={cn('inline-flex h-[34px] items-center rounded-full border border-white/22 bg-black/28 px-3 text-[13px] font-semibold', className)}>Demo AI</span>
}

export function PrivacyLine({ children = 'Your videos stay on this device.', className }: { children?: React.ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2 text-[14px] font-medium text-white/80', className)}>
      <Lock className="size-4 shrink-0" strokeWidth={2.2} aria-hidden /> {children}
    </p>
  )
}
