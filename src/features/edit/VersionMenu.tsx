import { useEffect, useRef, useState } from 'react'
import { ChevronDown, History, Plus } from 'lucide-react'
import type { Project, SavedVersion } from '@/domain/types'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { undo } from './editActions'
import { hasUnsavedChanges, restoreVersion, saveVersion, versionLabel } from './versions'

const when = (t: number) => {
  const d = new Date(t)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const today = new Date().toDateString() === d.toDateString()
  return today ? `Today, ${time}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

/**
 * "Versions ▾": saved checkpoints, newest first (like Figma's version history).
 * Save one by name, or bring an older one back; what's there now is saved first.
 */
export function VersionMenu({ project }: { project: Project }) {
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const versions = [...(project.versions ?? [])].reverse()
  const unsaved = hasUnsavedChanges(project)
  const save = async () => {
    await saveVersion('manual', name || undefined)
    setName('')
    setNaming(false)
    toast(name.trim() ? `Saved “${name.trim()}”` : 'Version saved', 'success')
  }
  const restore = async (v: SavedVersion) => {
    setOpen(false)
    await restoreVersion(v.id)
    toast(`Back to “${versionLabel(v)}”`, 'success', { label: 'Undo', run: () => void undo() })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          setNaming(false)
        }}
        data-testid="versions"
        className="flex h-10 items-center gap-1.5 rounded-full bg-white/6 pr-3 pl-3.5 text-[14px] transition hover:bg-white/10"
      >
        <History className="size-4 shrink-0" strokeWidth={2.4} />
        <span className="font-semibold whitespace-nowrap max-sm:sr-only">Versions</span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} strokeWidth={2.4} />
      </button>
      {open && (
        <div role="dialog" aria-label="Versions" className="absolute top-12 right-0 z-40 w-[320px] max-w-[calc(100vw-32px)] rounded-[18px] bg-surface-2 p-1.5 shadow-lift">
          <div className="px-3 pt-2 pb-2.5">
            <p className="text-[13px] text-muted">Saved after each editing session, before Ask AI changes and when you export. Undo still goes back one change at a time.</p>
            {naming ? (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void save()
                }}
              >
                <input
                  autoFocus
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name it (optional)"
                  aria-label="Version name"
                  className="h-10 min-w-0 flex-1 rounded-full bg-white/6 px-4 text-[14px] outline-none placeholder:text-white/40 focus:shadow-[inset_0_0_0_1.5px_#ff5a1f]"
                />
                <button type="submit" className="h-10 shrink-0 rounded-full bg-white px-4 text-[14px] font-bold text-ink">
                  Save
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setNaming(true)} className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-white/8 text-[14px] font-bold transition hover:bg-white/12">
                <Plus className="size-4" strokeWidth={2.6} /> Save version
              </button>
            )}
          </div>
          <ul aria-label="Saved versions" className="max-h-[50vh] overflow-y-auto border-t border-white/8 pt-1.5">
            <li className="flex items-center gap-2 rounded-[12px] bg-white/6 px-3 py-2.5 text-[14px]">
              <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Now</span>
                <span className="block text-[13px] text-muted">{unsaved ? 'Changes since the last version' : 'Same as the latest version'}</span>
              </span>
            </li>
            {versions.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => void restore(v)} className="group flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-[14px] transition hover:bg-white/6">
                  <span className="size-2 shrink-0 rounded-full bg-white/25" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{versionLabel(v)}</span>
                    <span className="block text-[13px] text-muted">
                      {when(v.createdAt)}
                      {v.changes > 0 && ` · ${v.changes} change${v.changes === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-ember-300 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">Restore</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
