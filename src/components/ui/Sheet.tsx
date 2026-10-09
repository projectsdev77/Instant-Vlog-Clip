import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Bottom sheet on phones (slides up, grabber, top corners rounded), centred
 * modal on desktop (max 480px). Tapping the scrim closes it.
 */
export function Sheet({ open, onClose, title, children, wide, hideTitle }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; hideTitle?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 animate-[fade_.16s_ease-out]" onClick={onClose} />
      <div
        className={cn(
          'relative max-h-[90vh] w-full overflow-y-auto rounded-t-[var(--radius-sheet)] bg-surface px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift md:rounded-[var(--radius-sheet)] md:px-7 md:pt-6 md:pb-7',
          wide ? 'md:max-w-[560px]' : 'md:max-w-[480px]',
          'animate-[sheet-up_.22s_cubic-bezier(.2,.7,.2,1)] md:animate-[fade_.16s_ease-out]',
        )}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/20 md:hidden" aria-hidden />
        <div className={cn('mb-4 flex items-start justify-between gap-3', hideTitle && 'sr-only')}>
          <h2 className="title-2">{title}</h2>
          <button type="button" onClick={onClose} className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-fg" aria-label="Close">
            <X className="size-5" strokeWidth={2.4} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
