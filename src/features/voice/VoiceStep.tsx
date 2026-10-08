import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Captions, Check, Mic, Pause, Play, Sparkles, Square } from 'lucide-react'
import { voices, AiError, ai } from '@/ai'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import type { ScriptLine, VoiceMode } from '@/domain/types'
import { hasFreshAudio } from '@/domain/timing'
import { cn } from '@/lib/cn'
import { getMediaUrl } from '@/lib/mediaStore'
import { useProject } from '@/store/projectStore'
import { saveRecording } from '@/pipeline/voice'
import { StepFooter } from '@/features/project/ProjectLayout'
import { stepIndex, stepPath } from '@/features/project/steps'
import { startRecording, type Recording } from './recorder'

const MODES: { id: VoiceMode; title: string; body: string; icon: typeof Sparkles }[] = [
  { id: 'ai', title: 'AI voice', body: 'Pick a voice to read your script.', icon: Sparkles },
  { id: 'recorded', title: 'Record my own', body: 'Read each line with a teleprompter.', icon: Mic },
  { id: 'none', title: 'No voiceover', body: 'Your lines appear as captions only.', icon: Captions },
]

export function VoiceStep() {
  const { project, updateProject } = useProject()
  const navigate = useNavigate()
  if (!project) return null
  const lines = project.script?.lines ?? []
  const recorded = lines.filter((l) => hasFreshAudio(l) && l.audio?.source === 'recorded').length
  const mode = project.voice.mode
  const canContinue = mode !== 'recorded' || recorded === lines.length

  const next = async () => {
    if (stepIndex(project.step) < stepIndex('generate')) await updateProject({ step: 'generate' })
    navigate(stepPath(project.id, 'generate'))
  }

  return (
    <>
      <main className="flex-1 space-y-5 px-4 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pick a voice</h1>
          <p className="mt-1 text-sm text-muted">Who tells the story?</p>
        </div>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => updateProject((p) => ({ voice: { ...p.voice, mode: m.id } }))}
              className={cn(
                'flex items-start gap-3 rounded-[var(--radius-card)] border p-3.5 text-left transition',
                mode === m.id ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface',
              )}
            >
              <m.icon className={cn('mt-0.5 size-5 shrink-0', mode === m.id ? 'text-accent' : 'text-muted')} />
              <span>
                <span className="block font-medium">{m.title}</span>
                <span className="block text-sm text-muted">{m.body}</span>
              </span>
            </button>
          ))}
        </div>

        {mode === 'ai' && <VoicePicker sample={lines[0]?.text ?? "So here's how today went."} />}
        {mode === 'recorded' && <RecordLines lines={lines} />}
        {mode === 'none' && <p className="rounded-[var(--radius-card)] bg-surface p-4 text-sm text-muted">Your script will show as on-screen captions, timed to the music.</p>}
      </main>
      <StepFooter hint={mode === 'recorded' ? `${recorded} of ${lines.length} lines recorded` : undefined}>
        <Button block size="lg" disabled={!canContinue} onClick={next}>
          Make my vlog
        </Button>
      </StepFooter>
    </>
  )
}

const previewCache = new Map<string, string>()

function VoicePicker({ sample }: { sample: string }) {
  const { project, updateProject } = useProject()
  const [loading, setLoading] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => () => audioRef.current?.pause(), [])
  if (!project) return null

  const preview = async (voiceId: string) => {
    audioRef.current?.pause()
    if (playing === voiceId) {
      setPlaying(null)
      return
    }
    const key = `${voiceId}:${sample}`
    let url = previewCache.get(key)
    if (!url) {
      setLoading(voiceId)
      try {
        const { audio } = await ai.synthesize(sample, voiceId, project.settings.language)
        url = URL.createObjectURL(audio)
        previewCache.set(key, url)
      } catch (e) {
        toast(e instanceof AiError ? e.message : "Couldn't play a preview.", 'error')
        return
      } finally {
        setLoading(null)
      }
    }
    const el = new Audio(url)
    audioRef.current = el
    el.onended = () => setPlaying(null)
    setPlaying(voiceId)
    void el.play()
  }

  return (
    <div role="radiogroup" aria-label="Voices" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {voices.map((v) => {
        const selected = project.voice.voiceId === v.id
        return (
          <Card key={v.id} className={cn('relative p-3', selected && 'border-accent ring-1 ring-accent')}>
            <button type="button" role="radio" aria-checked={selected} className="block w-full pr-9 text-left" onClick={() => updateProject((p) => ({ voice: { ...p.voice, voiceId: v.id } }))}>
              <span className="flex items-center gap-1.5 font-medium">
                {v.name} {selected && <Check className="size-4 text-accent" />}
              </span>
              <span className="block text-xs text-muted">{v.description}</span>
              <span className="block text-xs text-muted">{v.accent}</span>
            </button>
            <button type="button" onClick={() => preview(v.id)} className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-surface-2" aria-label={`Preview ${v.name}`}>
              {loading === v.id ? <Spinner /> : playing === v.id ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          </Card>
        )
      })}
    </div>
  )
}

function RecordLines({ lines }: { lines: ScriptLine[] }) {
  const [active, setActive] = useState<number | null>(null)
  return (
    <>
      <ol className="space-y-2">
        {lines.map((l, i) => {
          const done = hasFreshAudio(l) && l.audio?.source === 'recorded'
          return (
            <li key={l.id}>
              <Card className="flex items-center gap-3 p-3">
                <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold', done ? 'bg-success text-white' : 'bg-surface-2 text-muted')}>{done ? <Check className="size-4" /> : i + 1}</span>
                <span className="flex-1 text-sm">{l.text}</span>
                {done && <PlayButton mediaKey={l.audio!.mediaKey} />}
                <Button size="sm" variant={done ? 'ghost' : 'secondary'} onClick={() => setActive(i)}>
                  <Mic className="size-4" /> {done ? 'Redo' : 'Record'}
                </Button>
              </Card>
            </li>
          )
        })}
      </ol>
      {active !== null && <Teleprompter lines={lines} start={active} onClose={() => setActive(null)} />}
    </>
  )
}

function PlayButton({ mediaKey }: { mediaKey: string }) {
  const [playing, setPlaying] = useState(false)
  const ref = useRef<HTMLAudioElement | null>(null)
  useEffect(() => () => ref.current?.pause(), [])
  const toggle = async () => {
    if (playing) {
      ref.current?.pause()
      setPlaying(false)
      return
    }
    const url = await getMediaUrl(mediaKey)
    if (!url) return
    ref.current = new Audio(url)
    ref.current.onended = () => setPlaying(false)
    setPlaying(true)
    void ref.current.play()
  }
  return (
    <button type="button" onClick={toggle} className="grid size-8 place-items-center rounded-full bg-surface-2" aria-label={playing ? 'Stop' : 'Play recording'}>
      {playing ? <Square className="size-3.5" /> : <Play className="size-4" />}
    </button>
  )
}

/** One line at a time, big text, tap to record / stop; advances automatically. */
function Teleprompter({ lines, start, onClose }: { lines: ScriptLine[]; start: number; onClose: () => void }) {
  const project = useProject((s) => s.project)
  const [index, setIndex] = useState(start)
  const [state, setState] = useState<'idle' | 'recording' | 'saving'>('idle')
  const [level, setLevel] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const recRef = useRef<Recording | null>(null)
  const line = lines[index]

  useEffect(() => {
    if (state !== 'recording') return
    const t0 = performance.now()
    let raf = 0
    const tick = () => {
      setLevel(recRef.current?.level() ?? 0)
      setElapsed((performance.now() - t0) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state])

  useEffect(() => () => recRef.current?.cancel(), [])

  const toggle = async () => {
    if (state === 'idle') {
      try {
        recRef.current = await startRecording()
        setState('recording')
      } catch {
        toast('Microphone access is needed to record. Check your browser settings.', 'error')
      }
      return
    }
    if (state === 'recording' && recRef.current) {
      setState('saving')
      const blob = await recRef.current.stop()
      recRef.current = null
      try {
        await saveRecording(line, blob, project?.settings.language ?? 'en')
        if (index < lines.length - 1) setIndex(index + 1)
        else onClose()
      } catch {
        toast("Couldn't save that take. Try again.", 'error')
      }
      setState('idle')
    }
  }

  return (
    <Sheet open title={`Line ${index + 1} of ${lines.length}`} onClose={() => state !== 'saving' && onClose()}>
      <div className="flex min-h-[50vh] flex-col items-center justify-between gap-6 py-4 text-center">
        <p className="text-2xl leading-snug font-semibold sm:text-3xl">{line.text}</p>
        <div className="flex flex-col items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-danger transition-[width] duration-75" style={{ width: `${state === 'recording' ? level * 100 : 0}%` }} />
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={state === 'saving'}
            aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
            className={cn('grid size-20 place-items-center rounded-full text-white shadow-lg transition', state === 'recording' ? 'bg-danger' : 'bg-accent')}
          >
            {state === 'saving' ? <Spinner className="size-6" /> : state === 'recording' ? <Square className="size-7" fill="currentColor" /> : <Mic className="size-8" />}
          </button>
          <span className="text-sm text-muted">{state === 'recording' ? `${elapsed.toFixed(1)}s · tap to stop` : state === 'saving' ? 'Saving…' : 'Tap to record this line'}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={index === 0 || state !== 'idle'} onClick={() => setIndex(index - 1)}>
            Previous
          </Button>
          <Button variant="ghost" size="sm" disabled={index === lines.length - 1 || state !== 'idle'} onClick={() => setIndex(index + 1)}>
            Skip
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
