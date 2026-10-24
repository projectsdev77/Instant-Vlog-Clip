import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { Project } from '@/domain/types'
import { cn } from '@/lib/cn'
import { openVersion } from './editActions'

/** "Version 3 · Punchier ▾": opens any saved version, newest first. */
export function VersionMenu({ project }: { project: Project }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = project.edits[project.currentEdit]
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
  if (!current) return null
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-testid="version-note"
        title={current.note}
        className="flex h-10 max-w-[230px] items-center gap-1.5 rounded-full bg-white/6 pr-3 pl-4 text-[14px] transition hover:bg-white/10"
      >
        <span className="font-semibold whitespace-nowrap">Version {current.version}</span>
        {current.note && <span className="truncate text-muted">· {current.note.replace(/[“”]/g, '')}</span>}
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} strokeWidth={2.4} />
      </button>
      {open && (
        <ul role="listbox" aria-label="Versions" className="absolute top-12 right-0 z-40 max-h-[60vh] w-[300px] overflow-y-auto rounded-[18px] bg-surface-2 p-1.5 shadow-lift">
          {project.edits
            .map((e, i) => ({ e, i }))
            .reverse()
            .map(({ e, i }) => {
              const on = i === project.currentEdit
              return (
                <li key={`${e.version}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setOpen(false)
                      if (!on) void openVersion(i)
                    }}
                    className={cn('flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-[14px] transition hover:bg-white/6', on && 'bg-white/8')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">Version {e.version}</span>
                      {e.note && <span className="block truncate text-[13px] text-muted">{e.note.replace(/[“”]/g, '')}</span>}
                    </span>
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
