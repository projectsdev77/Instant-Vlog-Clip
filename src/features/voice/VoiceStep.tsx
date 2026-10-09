import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AudioLines, Captions, Check, Mic, Play, Square } from 'lucide-react'
import { voices, AiError, ai } from '@/ai'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import type { ScriptLine, VoiceMode } from '@/domain/types'
import { hasFreshAudio } from '@/domain/timing'
import { cn } from '@/lib/cn'
import { getMediaUrl } from '@/lib/mediaStore'
import { useProject } from '@/store/projectStore'
import { StepFooter, StepHeading, StepPage } from '@/features/project/ProjectLayout'
import { stepIndex, stepPath } from '@/features/project/steps'
import { Teleprompter } from './Teleprompter'

const MODES: { id: VoiceMode; title: string; body: string; icon: typeof Mic }[] = [
  { id: 'ai', title: 'AI voice', body: 'Six natural voices read your lines.', icon: AudioLines },
  { id: 'recorded', title: 'Record my own', body: 'Read each line with a teleprompter.', icon: Mic },
  { id: 'none', title: 'No voiceover', body: 'Your lines appear as captions only.', icon: Captions },
]

export const isRecorded = (l: ScriptLine) => hasFreshAudio(l) && l.audio?.source === 'recorded'

export function VoiceStep() {
  const { project, updateProject } = useProject()
  const navigate = useNavigate()
  const [tele, setTele] = useState<number | null>(null)
  if (!project) return null
  const lines = project.script?.lines ?? []
  const recorded = lines.filter(isRecorded).length
  const mode = project.voice.mode
  const voice = voices.find((v) => v.id === project.voice.voiceId) ?? voices[0]
  const canContinue = mode !== 'recorded' || recorded === lines.length

  const next = async () => {
    if (stepIndex(project.step) < stepIndex('generate')) await updateProject({ step: 'generate' })
    navigate(stepPath(project.id, 'generate'))
  }
  const firstUnrecorded = () => Math.max(0, lines.findIndex((l) => !isRecorded(l)))

  const summary = mode === 'ai' ? `${voice.name} · ${voice.description.toLowerCase()}` : mode === 'recorded' ? `${recorded} of ${lines.length} lines recorded` : 'Captions only, no voiceover'

  return (
    <>
      <StepPage>
        <StepHeading step={3} title="Who tells the story?" />
        <div role="radiogroup" aria-label="Voiceover" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {MODES.map((m) => {
            const selected = mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updateProject((p) => ({ voice: { ...p.voice, mode: m.id } }))}
                className={cn(
                  'flex items-center gap-4 rounded-[var(--radius-card)] p-[18px] text-left transition duration-150 ease-ember',
                  selected ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_#ff5a1f]' : 'bg-surface hover:bg-[#1a1918]',
                )}
              >
                <span className={cn('grid size-[42px] shrink-0 place-items-center rounded-xl', selected ? 'bg-accent text-white' : 'bg-surface-2 text-fg')}>
                  <m.icon className="size-5" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold">{m.title}</span>
                  <span className="block text-[14px] text-muted">{m.body}</span>
                </span>
                {selected && (
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-8">
          {mode === 'ai' && <VoicePicker sample={lines[0]?.text ?? "So here's how today went."} />}
          {mode === 'recorded' && <RecordLines lines={lines} onOpen={(i) => setTele(i)} openFirst={() => setTele(firstUnrecorded())} />}
          {mode === 'none' && (
            <div className="flex flex-wrap items-center gap-5 rounded-[var(--radius-panel)] bg-surface p-6">
              <div className="grid aspect-[9/16] w-[92px] place-items-end overflow-hidden rounded-[var(--radius-thumb)] bg-[linear-gradient(175deg,#cfe6ea_0%,#6fa7b4_34%,#2b5763_70%,#0c1a1f_100%)] p-2">
                <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-extrabold">
                  Captions do the <span className="text-ember-200">talking.</span>
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-bold">Captions do the talking</div>
                <p className="mt-1 text-muted">Your lines appear on screen, timed to the music. You can add a voice later.</p>
              </div>
            </div>
          )}
        </div>
      </StepPage>
      <StepFooter summary={summary}>
        <Button variant="ember" disabled={!canContinue} onClick={next}>
          Make my vlog
        </Button>
      </StepFooter>
      {tele !== null && <Teleprompter lines={lines} start={tele} onClose={() => setTele(null)} />}
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
    setPlaying(null)
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
    <>
      <p className="mb-4 text-[15px] text-muted">Play reads your first line: “{sample}”</p>
      <div role="radiogroup" aria-label="Voices" className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {voices.map((v) => {
          const selected = project.voice.voiceId === v.id
          return (
            <div key={v.id} className={cn('flex items-center gap-3 rounded-[var(--radius-card)] p-3.5 transition', selected ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_#ff5a1f]' : 'bg-surface')}>
              <button type="button" role="radio" aria-checked={selected} onClick={() => updateProject((p) => ({ voice: { ...p.voice, voiceId: v.id } }))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-full text-[17px] font-extrabold', selected ? 'bg-accent text-white' : 'bg-surface-2')}>{v.name[0]}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-bold">
                    {v.name} <span className="text-[12px] font-semibold text-faint">{v.accent}</span>
                  </span>
                  <span className="block text-[14px] leading-snug text-muted">{v.description}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => preview(v.id)}
                className={cn('grid size-11 shrink-0 place-items-center rounded-full transition', selected ? 'bg-white text-ink' : 'bg-surface-2 text-fg hover:bg-[#262321]')}
                aria-label={playing === v.id ? `Stop ${v.name}` : `Preview ${v.name}`}
              >
                {loading === v.id ? <Spinner /> : playing === v.id ? <Bars /> : <Play className="ml-0.5 size-4" fill="currentColor" />}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

/** Three animated bars for "playing". */
export function Bars() {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className="h-full w-[3px] origin-bottom animate-bar rounded-full bg-current" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  )
}

function RecordLines({ lines, onOpen, openFirst }: { lines: ScriptLine[]; onOpen: (i: number) => void; openFirst: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] bg-surface p-5">
        <p className="max-w-[52ch] text-muted">Read each line out loud. We trim the silence, even out the volume and time the captions to your voice.</p>
        <Button onClick={openFirst}>
          <span className="size-2.5 rounded-full bg-danger" /> Open teleprompter
        </Button>
      </div>
      <ol className="space-y-2">
        {lines.map((l, i) => {
          const done = isRecorded(l)
          return (
            <li key={l.id} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-3 pl-4">
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-bold', done ? 'bg-success text-success-fg' : 'bg-surface-2 text-muted')}>
                {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1 text-[15px]">{l.text}</span>
              {done && <PlayButton mediaKey={l.audio!.mediaKey} />}
              <Button size="sm" variant={done ? 'quiet' : 'primary'} className={cn(done && 'bg-white/8')} onClick={() => onOpen(i)}>
                {done ? 'Redo' : 'Record'}
              </Button>
            </li>
          )
        })}
      </ol>
    </div>
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
    <button type="button" onClick={toggle} className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 hover:bg-[#262321]" aria-label={playing ? 'Stop' : 'Play recording'}>
      {playing ? <Square className="size-3.5" fill="currentColor" /> : <Play className="ml-0.5 size-4" fill="currentColor" />}
    </button>
  )
}
