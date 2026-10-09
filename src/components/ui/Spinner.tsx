import { cn } from '@/lib/cn'

/** Orange ring spinner (0.9s). */
export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-4 animate-spin rounded-full border-2 border-white/15 border-t-accent [animation-duration:.9s]', className)} />
}
