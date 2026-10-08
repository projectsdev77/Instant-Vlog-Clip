import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { getMedia } from '@/lib/mediaStore'
import { resumePending } from '@/features/clips/importClips'
import { useProject } from '@/store/projectStore'
import { STEPS, stepIndex, stepPath } from './steps'

export function ProjectLayout() {
  const { projectId = '' } = useParams()
  const { project, load } = useProject()
  const location = useLocation()
  const [loadedId, setLoadedId] = useState<string | null>(null)

  useEffect(() => {
    void load(projectId).then(() => {
      setLoadedId(projectId)
      return resumePending(getMedia)
    })
  }, [projectId, load])

  if (loadedId !== projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!project) return <Navigate to="/" replace />

  const current = location.pathname.split('/').pop()
  const currentIdx = STEPS.findIndex((s) => s.id === current)
  const reached = stepIndex(project.step)

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center gap-2">
          <Link to="/" className="-ml-2 rounded-full p-2 hover:bg-surface" aria-label="All vlogs">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 truncate font-semibold">{project.title || 'New vlog'}</div>
        </div>
        <nav className="-mx-1 flex gap-1 pb-3" aria-label="Steps">
          {STEPS.map((s, i) => {
            const enabled = i <= reached
            const active = i === currentIdx
            return (
              <Link
                key={s.id}
                to={enabled ? stepPath(project.id, s.id) : '#'}
                aria-current={active ? 'step' : undefined}
                aria-disabled={!enabled}
                onClick={(e) => !enabled && e.preventDefault()}
                className={cn(
                  'flex-1 rounded-full py-1.5 text-center text-xs font-medium transition',
                  active ? 'bg-accent text-accent-fg' : enabled ? 'bg-surface text-fg hover:bg-surface-2' : 'bg-surface text-muted opacity-60',
                )}
              >
                {s.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <Outlet />
    </div>
  )
}

/** Sticky bottom bar holding a step's main action. */
export function StepFooter({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 mt-auto border-t border-border bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      {hint && <div className="mb-2 text-center text-xs text-muted">{hint}</div>}
      <div className="flex gap-2">{children}</div>
    </div>
  )
}
