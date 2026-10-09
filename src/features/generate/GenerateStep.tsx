import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, X } from 'lucide-react'
import { AiError } from '@/ai'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { useProject } from '@/store/projectStore'
import { generateVlog, STAGES, type Progress as P } from '@/pipeline/generate'
import { stepPath } from '@/features/project/steps'
import { authEnabled, useAuthSheet } from '@/features/auth/auth'
import { COVER_BG } from '@/features/home/covers'

const TILT = ['-9deg', '4deg', '-3deg', '8deg']
const FALLBACK = [COVER_BG.day, COVER_BG.over, COVER_BG.sea, COVER_BG.gold]

export function GenerateStep() {
  const { project, clips } = useProject()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<P>({ stage: 'watching' })
  // Keep each stage's last detail ("6 clips") so finished stages still show it.
  const [details, setDetails] = useState<Record<string, string>>({})
  const onProgress = useCallback((p: P) => {
    setProgress(p)
    if (p.detail) setDetails((d) => ({ ...d, [p.stage]: p.detail!.replace(/^\d+ of /, '') }))
  }, [])
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const start = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      await generateVlog(onProgress)
      navigate(stepPath(project.id, 'edit') + '?play=1', { replace: true })
    } catch (e) {
      setError((e as Error).message || 'Something went wrong.')
      if (authEnabled && e instanceof AiError && (e.code === 'quota' || e.code === 'auth')) useAuthSheet.getState().show(e.message)
    }
  }, [project, navigate, onProgress])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void start()
  }, [start])

  if (!project) return null
  const stageIdx = STAGES.findIndex((s) => s.id === progress.stage)
  const overall = (stageIdx + (progress.fraction ?? 0.5)) / STAGES.length
  const thumbs = clips.filter((c) => c.thumbnail).slice(0, 4)
  const voicingLabel = project.voice.mode === 'recorded' ? 'Cleaning up your recordings' : project.voice.mode === 'none' ? 'Timing your captions' : 'Voicing your script'
  const label = (id: string, base: string) => (id === 'voicing' ? voicingLabel : base)

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-4 pt-10 pb-12 md:pt-12">
      <div className="ember-motion pointer-events-none absolute inset-0" aria-hidden>
        <div className="ember-streak top-[38%] animate-sweep" />
        <div className="ember-streak top-[62%] h-px animate-sweep opacity-60 [animation-duration:4.4s]" />
        <div className="ember-grain" />
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-b from-transparent via-[rgb(9_9_10/.85)] via-50% to-bg" />
      </div>

      <div className="relative flex w-full max-w-[560px] flex-col items-center text-center">
        <div className="flex h-[150px] items-center justify-center md:h-[190px]" aria-hidden>
          {(thumbs.length ? thumbs : FALLBACK.map(() => null)).map((c, i) => (
            <div
              key={c?.id ?? i}
              className="-mx-2 aspect-[9/16] w-[78px] animate-float overflow-hidden rounded-[14px] shadow-cover md:w-[96px]"
              style={{ ['--r' as string]: TILT[i], animationDelay: `${i * 0.35}s`, background: FALLBACK[i] }}
            >
              {c?.thumbnail && <img src={c.thumbnail} alt="" className="size-full object-cover" />}
            </div>
          ))}
        </div>

        <div className="mt-6 text-[13px] font-semibold tracking-[0.14em] text-white/80 uppercase">Making your vlog</div>
        <h1 className="mt-2 text-[clamp(30px,4.4vw,44px)] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance">{project.title || 'Your vlog'}</h1>

        <div className="mt-7 w-full rounded-[var(--radius-panel)] bg-[rgb(9_9_10/.66)] p-5 text-left shadow-[inset_0_0_0_1px_rgb(255_255_255/.08)] backdrop-blur-[16px]">
          {!error && <Progress value={overall} className="mb-4" />}
          <ol className="space-y-3.5" aria-live="polite">
            {STAGES.map((s, i) => {
              const done = i < stageIdx
              const active = i === stageIdx && !error
              const failed = i === stageIdx && !!error
              return (
                <li key={s.id} className={cn('flex items-center gap-3.5 text-[16px]', done || active || failed ? 'text-fg' : 'text-white/45')}>
                  <span
                    className={cn(
                      'grid size-[30px] shrink-0 place-items-center rounded-full',
                      done && 'bg-success text-success-fg',
                      failed && 'bg-danger text-danger-fg',
                      active && 'animate-spin border-2 border-white/12 border-t-accent [animation-duration:.9s]',
                      !done && !active && !failed && 'bg-white/8',
                    )}
                  >
                    {done && <Check className="size-4" strokeWidth={3} />}
                    {failed && <X className="size-4" strokeWidth={3} />}
                  </span>
                  <span className={cn('flex-1', active && 'font-bold')}>{label(s.id, s.label)}</span>
                  {active && progress.stage === s.id && progress.detail ? (
                    <span className="tabular text-[13px] font-medium text-muted">{progress.detail}</span>
                  ) : (
                    done && details[s.id] && <span className="tabular text-[13px] font-medium text-muted">{details[s.id]}</span>
                  )}
                </li>
              )
            })}
          </ol>
          {error && (
            <div className="mt-5 rounded-[var(--radius-card)] bg-danger-surface p-4 shadow-[inset_0_0_0_1px_rgb(255_79_79/.35)]">
              <p className="text-[15px]">
                We couldn’t finish “{label(STAGES[stageIdx].id, STAGES[stageIdx].label).toLowerCase()}”. {error} Nothing was lost.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={start}>Try again</Button>
                <Button variant="outline" onClick={() => navigate(stepPath(project.id, project.voice.mode === 'recorded' ? 'voice' : 'script'))}>
                  Go back
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="mt-6 text-[14px] font-medium text-muted">Usually under a minute. Everything happens on this device.</p>
      </div>
    </main>
  )
}
