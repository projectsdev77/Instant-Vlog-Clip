import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Chip({ selected, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'h-11 shrink-0 rounded-full px-3.5 text-[15px] transition duration-150 ease-ember active:scale-[.98] disabled:opacity-40',
        selected ? 'bg-white font-bold text-ink' : 'ring-hair bg-transparent font-medium text-fg hover:bg-white/6',
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
    <div className="space-y-2.5">
      <div className="text-[15px] font-semibold">{label}</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => (
          <Chip key={String(o.value)} selected={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}
