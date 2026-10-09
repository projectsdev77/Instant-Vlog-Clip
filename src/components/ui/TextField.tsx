import { forwardRef, useLayoutEffect, useRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const base =
  'w-full rounded-[var(--radius-input)] bg-surface-2 px-4 text-[16px] text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/.08)] outline-none transition duration-150 ease-ember placeholder:text-white/40 focus:shadow-[inset_0_0_0_1.5px_#ff5a1f,0_0_0_4px_rgb(255_90_31/.18)] disabled:opacity-60'

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function TextInput(
  { className, invalid, ...props },
  ref,
) {
  return <input ref={ref} className={cn(base, 'h-13', invalid && 'shadow-[inset_0_0_0_1.5px_#ff4f4f]', className)} {...props} />
})

/** Textarea that grows with its content. */
export function AutoTextarea({ className, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return <textarea ref={ref} rows={1} value={value} className={cn(base, 'min-h-13 resize-none py-3.5 leading-snug', className)} {...props} />
}

export function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block text-[15px] font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-[13px] font-medium text-faint">{hint}</span>}
    </label>
  )
}
