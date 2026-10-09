import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/Spinner'
import type { ScriptLine } from '@/domain/types'
import { cn } from '@/lib/cn'
import { useProject } from '@/store/projectStore'
import { saveRecording } from '@/pipeline/voice'
import { hasFreshAudio } from '@/domain/timing'
import { startRecording, type Recording } from './recorder'

const BARS = 28
const isRecorded = (l: ScriptLine) => hasFreshAudio(l) && l.audio?.source === 'recorded'

/** Full screen: one line at a time, big text, tap to record / stop, moves on by itself. */
export function Teleprompter({ lines, start, onClose }: { lines: ScriptLine[]; start: number; onClose: () => void }) {
  const project = useProject((s) => s.project)
  const [index, setIndex] = useState(start)
  const [state, setState] = useState<'idle' | 'recording' | 'saving'>('idle')
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0))
  const [elapsed, setElapsed] = useState(0)
  const recRef = useRef<Recording | null>(null)
  const line = lines[index]

  useEffect(() => {
    if (state !== 'recording') return
    const t0 = performance.now()
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      setElapsed((now - t0) / 1000)
      if (now - last > 60) {
        last = now
        const lv = recRef.current?.level() ?? 0
        setLevels((prev) => [...prev.slice(1), lv])
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state])

  useEffect(() => () => recRef.current?.cancel(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && state === 'idle' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, onClose])

  const toggle = async () => {
    if (state === 'idle') {
      try {
        recRef.current = await startRecording()
        setElapsed(0)
        setState('recording')
      } catch {
        toast('Microphone blocked. Allow it in your browser’s site settings, then try again.', 'error')
      }
      return
    }
    if (state === 'recording' && recRef.current) {
      setState('saving')
      const blob = await recRef.current.stop()
      recRef.current = null
      try {
        await saveRecording(line, blob, project?.settings.language ?? 'en')
        const fresh = useProject.getState().project?.script?.lines ?? lines
        const nextIdx = fresh.findIndex((l, i) => i > index && !isRecorded(l))
        const anyLeft = fresh.findIndex((l) => !isRecorded(l))
        if (nextIdx >= 0) setIndex(nextIdx)
        else if (anyLeft >= 0) setIndex(anyLeft)
        else {
          toast('All lines recorded.', 'success')
          onClose()
        }
      } catch {
        toast("Couldn't save that take. Try again.", 'error')
      }
      setLevels(Array(BARS).fill(0))
      setState('idle')
    }
  }

  const recording = state === 'recording'
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={`Teleprompter, line ${index + 1} of ${lines.length}`}>
      <div className="ember-wash" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-10 md:pt-6">
        <button type="button" onClick={onClose} disabled={state !== 'idle'} className="grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-40" aria-label="Close teleprompter">
          <X className="size-5" strokeWidth={2.4} />
        </button>
        <span className="text-[15px] font-semibold">
          Line {index + 1} of {lines.length}
        </span>
        <span className={cn('tabular w-11 text-right text-[15px] font-semibold', recording ? 'text-danger' : 'text-muted')}>{`0:${String(Math.floor(elapsed)).padStart(2, '0')}`}</span>
      </div>

      <div className="relative mx-auto flex w-full max-w-[860px] flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="line-clamp-2 text-[18px] font-semibold text-white/25">{lines[index - 1]?.text ?? ''}</p>
        <p className="text-[clamp(34px,4.6vw,56px)] leading-[1.1] font-extrabold tracking-[-0.03em] text-balance">{line.text}</p>
        <p className="line-clamp-2 text-[18px] font-semibold text-white/25">{lines[index + 1]?.text ?? ''}</p>
      </div>

      <div className="relative flex flex-col items-center gap-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex h-10 items-center gap-[3px]" aria-hidden>
          {levels.map((l, i) => (
            <span key={i} className={cn('w-1 rounded-full transition-[height] duration-75', recording ? 'bg-accent' : 'bg-white/15')} style={{ height: `${Math.max(4, l * 40)}px` }} />
          ))}
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={state === 'saving'}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          className={cn('grid size-[84px] place-items-center rounded-full bg-danger text-white shadow-[0_0_0_4px_#fff] transition active:scale-95', recording && 'animate-pulse-rec')}
        >
          {state === 'saving' ? <Spinner className="size-7 border-white/30 border-t-white" /> : recording ? <span className="size-7 rounded-md bg-white" /> : <span className="size-[60px] rounded-full bg-danger" />}
        </button>
        <p className="text-[15px] font-medium text-muted" aria-live="polite">
          {recording ? 'Recording. Tap to stop.' : state === 'saving' ? 'Saving your take…' : 'Tap the button and read the line.'}
        </p>
        <div className="flex gap-6">
          <button type="button" className="h-11 px-3 text-[15px] font-semibold text-muted hover:text-fg disabled:opacity-30" disabled={index === 0 || state !== 'idle'} onClick={() => setIndex(index - 1)}>
            Previous
          </button>
          <button type="button" className="h-11 px-3 text-[15px] font-semibold text-muted hover:text-fg disabled:opacity-30" disabled={index === lines.length - 1 || state !== 'idle'} onClick={() => setIndex(index + 1)}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
