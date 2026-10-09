import { create } from 'zustand'
import { cn } from '@/lib/cn'

type Action = { label: string; run: () => void }
type Toast = { id: number; message: string; tone: 'info' | 'error' | 'success'; action?: Action }
type ToastState = { toasts: Toast[]; push: (message: string, tone?: Toast['tone'], action?: Action) => void; dismiss: (id: number) => void }

let nextId = 1

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = 'info', action) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone, action }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3600)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = (message: string, tone?: Toast['tone'], action?: Action) => useToasts.getState().push(message, tone, action)

/** Pill toasts, bottom-centre above the footer. */
export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-3 rounded-full py-2.5 pr-2.5 pl-4 text-[14px] font-medium shadow-lift animate-[sheet-up_.2s_cubic-bezier(.2,.7,.2,1)]',
            t.tone === 'error' ? 'bg-danger-surface shadow-[inset_0_0_0_1px_rgb(255_79_79/.35)]' : 'bg-surface-2',
          )}
        >
          <span className={cn('size-2 shrink-0 rounded-full', t.tone === 'error' ? 'bg-danger' : t.tone === 'success' ? 'bg-success' : 'bg-accent')} />
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action ? (
            <button
              type="button"
              className="h-9 shrink-0 rounded-full px-3 font-bold text-ember-300 hover:bg-white/6"
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          ) : (
            <button type="button" className="sr-only" onClick={() => dismiss(t.id)}>
              Dismiss
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
