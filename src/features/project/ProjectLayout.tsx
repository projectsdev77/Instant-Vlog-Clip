import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { Check } from 'lucide-react'
import { DemoBadge, LogoTile, Wordmark } from '@/components/Brand'
import { Spinner } from '@/components/ui/Spinner'
import { aiMode } from '@/ai/mode'
import { cn } from '@/lib/cn'
import { getMedia } from '@/lib/mediaStore'
import { resumePending } from '@/features/clips/importClips'
import { useProject } from '@/store/projectStore'
import type { ProjectStep } from '@/domain/types'
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
      <div className="flex h-dvh items-center justify-center">
        <Spinner className="size-7" />
      </div>
    )
  }
  if (!project) return <Navigate to="/" replace />

  const current = (location.pathname.split('/').pop() ?? 'clips') as ProjectStep
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <FlowHeader projectId={project.id} current={current} reached={stepIndex(project.step)} />
      <Outlet />
    </div>
  )
}

function FlowHeader({ projectId, current, reached }: { projectId: string; current: ProjectStep; reached: number }) {
  const navigate = useNavigate()
  const currentIdx = Math.max(0, STEPS.findIndex((s) => s.id === current))
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[rgb(9_9_10/.84)] pt-[env(safe-area-inset-top)] backdrop-blur-[14px]">
      <div className="mx-auto flex h-[68px] max-w-[1120px] items-center gap-3 px-4 md:px-10">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-xl" aria-label="Instant Vlog Clip home">
          <LogoTile size={34} />
          <Wordmark className="hidden lg:inline" />
        </Link>

        {/* Desktop: pill step bar */}
        <nav className="hidden flex-1 justify-center gap-1.5 md:flex" aria-label="Steps">
          {STEPS.map((s, i) => {
            const state = i === currentIdx ? 'current' : i <= reached ? 'done' : 'locked'
            // Make can't be re-entered once the vlog exists.
            const clickable = state === 'done' && s.id !== 'generate'
            return (
              <button
                key={s.id}
                type="button"
                aria-current={state === 'current' ? 'step' : undefined}
                disabled={!clickable}
                onClick={() => navigate(stepPath(projectId, s.id))}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-full px-[15px] text-[14px] transition duration-150 ease-ember',
                  state === 'current' && 'bg-white font-bold text-ink',
                  state === 'done' && 'bg-surface-2 font-semibold text-fg enabled:hover:bg-[#262321]',
                  state === 'locked' && 'text-white/40 shadow-[inset_0_0_0_1px_rgb(255_255_255/.1)]',
                )}
              >
                {state === 'current' && <span className="font-bold text-ember-700">{i + 1}</span>}
                {state === 'done' && <Check className="size-4 text-accent" strokeWidth={2.8} />}
                {s.label}
              </button>
            )
          })}
        </nav>

        {/* Phone: step label + segments */}
        <div className="min-w-0 flex-1 md:hidden">
          <div className="truncate text-[14px] font-semibold">
            Step {currentIdx + 1} of {STEPS.length} · {STEPS[currentIdx].label}
          </div>
          <div className="mt-1.5 flex gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.id} className={cn('h-1 flex-1 rounded-full', i === currentIdx ? 'bg-white' : i <= reached ? 'bg-accent' : 'bg-white/12')} />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 justify-end md:w-[160px]">{aiMode === 'mock' && <DemoBadge />}</div>
      </div>
    </header>
  )
}

/** Content column for a step, with the faint ember glow behind the heading. */
export function StepPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn('relative mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 pb-40 md:px-10 md:pt-12', className)}>
      <div className="ember-wash -z-10" aria-hidden />
      {children}
    </main>
  )
}

export function StepHeading({ step, title, sub }: { step?: number; title: string; sub?: ReactNode }) {
  return (
    <div className="mb-7 space-y-2">
      {step && <div className="eyebrow">Step {step} of 5</div>}
      <h1 className="title-1">{title}</h1>
      {sub && <p className="max-w-[60ch] text-[17px] text-muted">{sub}</p>}
    </div>
  )
}

/** Pinned footer: summary on the left, main action on the right, within thumb reach. */
export function StepFooter({ summary, children }: { summary?: ReactNode; children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-b from-transparent to-bg to-32%">
      <div className="pointer-events-auto mx-auto flex max-w-[1120px] items-center gap-3 px-4 pt-5 pb-[max(30px,env(safe-area-inset-bottom))] md:px-10 md:pt-7 md:pb-7">
        <div className="min-w-0 flex-1 text-[15px] font-medium text-muted">{summary}</div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </div>
  )
}
