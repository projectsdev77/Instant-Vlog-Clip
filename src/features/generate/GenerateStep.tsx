import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, RotateCcw } from 'lucide-react'
import { AiError } from '@/ai'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useProject } from '@/store/projectStore'
import { generateVlog, STAGES, type Progress as P } from '@/pipeline/generate'
import { stepPath } from '@/features/project/steps'
import { authEnabled, useAuthSheet } from '@/features/auth/auth'

export function GenerateStep() {
  const project = useProject((s) => s.project)
  const navigate = useNavigate()
  const [progress, setProgress] = useState<P>({ stage: 'watching' })
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const start = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      await generateVlog(setProgress)
      navigate(stepPath(project.id, 'edit'), { replace: true })
    } catch (e) {
      setError((e as Error).message || 'Something went wrong.')
      if (authEnabled && e instanceof AiError && (e.code === 'quota' || e.code === 'auth')) useAuthSheet.getState().show(e.message)
    }
  }, [project, navigate])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void start()
  }, [start])

  if (!project) return null
  const stageIdx = STAGES.findIndex((s) => s.id === progress.stage)
  const overall = (stageIdx + (progress.fraction ?? 0.5)) / STAGES.length

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold tracking-tight">{error ? 'That didn’t work' : 'Making your vlog'}</h1>
        <p className="mt-1 text-center text-sm text-muted">{error ?? 'This usually takes under a minute.'}</p>

        {!error && <Progress value={overall} className="mt-6" />}

        <ol className="mt-6 space-y-3" aria-live="polite">
          {STAGES.map((s, i) => {
            const done = i < stageIdx
            const active = i === stageIdx && !error
            return (
              <li key={s.id} className={cn('flex items-center gap-3 text-[15px]', !done && !active && 'text-muted')}>
                <span className={cn('grid size-6 shrink-0 place-items-center rounded-full', done ? 'bg-success text-white' : active ? 'bg-accent-soft text-accent' : 'bg-surface-2')}>
                  {done ? <Check className="size-3.5" /> : active ? <Spinner className="size-3.5" /> : null}
                </span>
                <span className="flex-1">{s.label}</span>
                {active && progress.detail && <span className="text-xs text-muted">{progress.detail}</span>}
              </li>
            )
          })}
        </ol>

        {error && (
          <div className="mt-8 flex flex-col gap-2">
            <Button size="lg" onClick={start}>
              <RotateCcw className="size-4" /> Try again
            </Button>
            <Button variant="ghost" onClick={() => navigate(stepPath(project.id, project.voice.mode === 'recorded' ? 'voice' : 'script'))}>
              Go back
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
