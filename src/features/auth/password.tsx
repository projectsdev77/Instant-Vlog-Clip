import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** What a new password needs. */
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /\p{Lu}/u.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One special character', test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
]

export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p))

/** The rules under a new-password field, each ticked off as it's met. */
export function PasswordRules({ password }: { password: string }) {
  return (
    <ul aria-label="Password needs" className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-1 text-[13px]">
      {PASSWORD_RULES.map((r) => {
        const met = r.test(password)
        return (
          <li key={r.label} className={cn('flex items-center gap-1.5', met ? 'text-success-soft' : 'text-faint')}>
            <span className={cn('grid size-4 shrink-0 place-items-center rounded-full', met ? 'bg-success text-ink' : 'border border-white/25')} aria-hidden>
              {met && <Check className="size-3" strokeWidth={3.2} />}
            </span>
            {r.label}
            <span className="sr-only">{met ? '(done)' : '(needed)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
