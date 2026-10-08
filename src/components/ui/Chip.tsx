import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Chip({ selected, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition',
        selected ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-bg text-fg hover:bg-surface',
        className,
      )}
      {...props}
    />
  )
}

export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted">{label}</div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={label}>
        {options.map((o) => (
          <Chip key={String(o.value)} selected={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}
