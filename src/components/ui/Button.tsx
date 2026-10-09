import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Ember buttons are always pills.
 * - primary: white, the one main action on a screen
 * - ember: orange, only for committing actions (Make my vlog, Export, Send)
 * - quiet: surface fill; outline: hairline ring; danger: red fill
 * - text / link: no fill (link is orange)
 */
type Variant = 'primary' | 'ember' | 'quiet' | 'outline' | 'danger' | 'text' | 'link'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-white text-ink hover:-translate-y-px',
  ember: 'bg-accent text-accent-fg shadow-ember hover:bg-accent-hover hover:-translate-y-px',
  quiet: 'bg-surface-2 text-fg hover:bg-[#262321]',
  outline: 'bg-transparent text-fg ring-hair hover:bg-white/5',
  danger: 'bg-danger text-danger-fg hover:brightness-110',
  text: 'bg-transparent text-fg hover:bg-white/6',
  link: 'bg-transparent text-ember-300 hover:text-ember-200',
}

const sizes: Record<Size, string> = {
  sm: 'h-11 px-4 text-[14px] gap-1.5',
  md: 'h-13 px-6 text-[16px] gap-2',
  lg: 'h-15 px-7 text-[17px] gap-2.5',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  block?: boolean
}

export function Button({ variant = 'primary', size = 'md', block, className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full font-semibold transition duration-150 ease-ember active:scale-[.98]',
        'disabled:pointer-events-none disabled:translate-y-0 disabled:bg-white/12 disabled:text-white/40 disabled:shadow-none',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
}

/** Round icon-only button, 44px. */
export function IconButton({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full text-fg transition duration-150 ease-ember hover:bg-white/8 active:scale-95 disabled:pointer-events-none disabled:opacity-30',
        className,
      )}
      {...props}
    />
  )
}
