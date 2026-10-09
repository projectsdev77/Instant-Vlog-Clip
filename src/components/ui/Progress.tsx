import { cn } from '@/lib/cn'

export function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/10', className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-ember-600 to-ember-200 transition-[width] duration-300 ease-ember" style={{ width: `${pct}%` }} />
    </div>
  )
}
