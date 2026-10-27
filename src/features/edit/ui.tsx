// Building blocks for the Edit panel (design handoff "Edit Inspector"):
// sections split by thin lines, label-left rows (label above on phones),
// segmented controls of up to 4 options, option cards and fold-away sections.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Pause, Play } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

export function Section({ title, helper, aside, children, className }: { title?: ReactNode; helper?: ReactNode; aside?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3 border-t border-border py-5 first:border-t-0 first:pt-0 last:pb-0', className)}>
      {(title || aside) && (
        <div className="flex items-baseline justify-between gap-3">
          {title && <h3 className="text-[15px] font-bold">{title}</h3>}
          {aside && <div className="tabular shrink-0 text-[13px] text-muted">{aside}</div>}
        </div>
      )}
      {children}
      {helper && <p className="text-[13px] text-white/55">{helper}</p>}
    </section>
  )
}

/** Label on the left (104px) on desktop, above the control on phones. */
export function Row({ label, children, htmlFor }: { label: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
      <label htmlFor={htmlFor} className="shrink-0 text-[14px] text-muted md:w-[104px]">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export type SegOption<T> = { value: T; label: string }

/**
 * Up to 4 options side by side. `more` holds the rest in a small menu next to
 * it, so nothing the app can do is lost while the control stays short.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  more,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: SegOption<T>[]
  more?: SegOption<T>[]
  value: T | undefined
  onChange: (v: T) => void
  disabled?: boolean
}) {
  const inMore = more?.find((o) => o.value === value)
  return (
    <div className="flex min-w-0 gap-2">
      <div role="radiogroup" aria-label={label} className="flex min-w-0 flex-1 rounded-full bg-surface-2 p-1">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => !on && onChange(o.value)}
              className={cn('h-[38px] min-w-0 flex-1 truncate rounded-full px-1 text-[12px] transition duration-150 ease-ember min-[400px]:px-2 min-[400px]:text-[13px] md:h-9 md:text-[14px] disabled:opacity-60', on ? 'bg-white font-bold text-ink' : 'font-medium text-white/72 hover:text-fg')}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {more && <MoreMenu label={label} options={more} picked={inMore} disabled={disabled} onPick={onChange} />}
    </div>
  )
}

/** The "More ▾" pill: a small dark menu (not the browser's own white list) with the rest of the options. */
function MoreMenu<T extends string | number>({ label, options, picked, disabled, onPick }: { label: string; options: SegOption<T>[]; picked?: SegOption<T>; disabled?: boolean; onPick: (v: T) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    // keyboard users land on the picked option, or the first one
    ref.current?.querySelector<HTMLButtonElement>('[role=option][aria-selected=true], [role=option]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  const step = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role=option]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`More ${label.toLowerCase()} options`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn('flex h-[46px] items-center gap-1.5 rounded-full text-[13px] transition duration-150 ease-ember md:h-11 md:pr-3 md:pl-3.5 md:text-[14px] disabled:opacity-60', picked ? 'bg-white pr-3 pl-3.5 font-bold text-ink' : 'w-[46px] justify-center bg-surface-2 font-medium text-white/72 hover:text-fg md:w-auto')}
      >
        {/* Phones: just the arrow until something under More is picked. */}
        <span className={cn('whitespace-nowrap', !picked && 'max-md:sr-only')}>{picked?.label ?? 'More'}</span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} strokeWidth={2.4} />
      </button>
      {open && (
        <ul role="listbox" aria-label={`More ${label.toLowerCase()} options`} onKeyDown={step} className="absolute top-[calc(100%+8px)] right-0 z-40 max-h-[50vh] min-w-[180px] overflow-y-auto rounded-[18px] bg-surface-2 p-1.5 shadow-lift">
          {options.map((o) => {
            const on = o.value === picked?.value
            return (
              <li key={String(o.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    setOpen(false)
                    if (!on) onPick(o.value)
                  }}
                  className={cn('flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-[14px] whitespace-nowrap transition hover:bg-white/6 focus-visible:bg-white/8 focus-visible:outline-none', on && 'bg-white/8 font-semibold')}
                >
                  <span className="flex-1">{o.label}</span>
                  {on && <Check className="size-4 shrink-0 text-accent" strokeWidth={3} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function Slider({ label, value, min, max, step = 1, format, onChange, onCommit }: { label: string; value: number; min: number; max: number; step?: number; format?: (v: number) => string; onChange: (v: number) => void; onCommit?: () => void }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} className="h-9 min-w-0 flex-1 accent-[#ff5a1f]" />
        <span className="tabular w-11 shrink-0 text-right text-[13px] text-muted">{format ? format(value) : value}</span>
      </div>
    </Row>
  )
}

/** A selectable card: 2px orange ring and a check badge when picked. */
export function OptionCard({ selected, onClick, children, className, label }: { selected: boolean; onClick: () => void; children: ReactNode; className?: string; label?: string }) {
  return (
    <button type="button" aria-pressed={selected} aria-label={label} onClick={onClick} className={cn('relative w-full overflow-hidden rounded-[18px] bg-surface-2 text-left transition duration-150 ease-ember', selected ? 'shadow-[0_0_0_2px_#ff5a1f]' : 'hover:bg-[#262321]', className)}>
      {children}
      {selected && (
        <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-accent text-white">
          <Check className="size-3.5" strokeWidth={3.2} />
        </span>
      )}
    </button>
  )
}

/** A row that opens to show more: title, a one-line summary, and a turning chevron. */
export function Fold({ title, summary, children, defaultOpen = false }: { title: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-t border-border py-5 first:border-t-0 first:pt-0 last:pb-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{title}</span>
          {summary && !open && <span className="block truncate text-[13px] text-white/55">{summary}</span>}
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2">
          <ChevronDown className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} strokeWidth={2.4} />
        </span>
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  )
}

/** Round play/stop button for samples (40px; orange while playing). */
export function PreviewButton({ playing, loading, onClick, label }: { playing: boolean; loading: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={playing}
      aria-label={playing ? `Stop ${label}` : `Preview ${label}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn('grid size-10 shrink-0 place-items-center rounded-full transition', playing ? 'bg-accent text-white' : 'bg-white/10 text-fg hover:bg-white/16')}
    >
      {loading ? <Spinner className="size-4" /> : playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="ml-0.5 size-4" fill="currentColor" />}
    </button>
  )
}

/** A two-column list row (voice, track) with an optional preview button. */
export function PickRow({ selected, onClick, leading, title, sub, trailing, disabled }: { selected: boolean; onClick: () => void; leading: ReactNode; title: ReactNode; sub?: ReactNode; trailing?: ReactNode; disabled?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-[18px] p-3 transition duration-150 ease-ember', selected ? 'bg-[rgb(255_90_31/.08)] shadow-[inset_0_0_0_1.5px_#ff5a1f]' : 'bg-surface-2 hover:bg-[#262321]')}>
      {leading}
      <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left disabled:opacity-60">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{title}</span>
          {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
        </span>
      </button>
      {trailing}
    </div>
  )
}

export const Avatar = ({ letter, on }: { letter: string; on: boolean }) => (
  <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-[15px] font-extrabold', on ? 'bg-accent text-white' : 'bg-white/10')}>{letter}</span>
)
