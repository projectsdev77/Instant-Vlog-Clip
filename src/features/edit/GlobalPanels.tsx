import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { stepPath } from '@/features/project/steps'
import { AudioLines, Captions, Check, ChevronRight, Lock, Mic, Music2, VolumeX } from 'lucide-react'
import { voices } from '@/ai'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import type { Clip, EditPlan, Project, VoiceMode } from '@/domain/types'
import type { Timeline } from '@/domain/timeline'
import { cn } from '@/lib/cn'
import { TRACKS } from '@/render/musicTracks'
import { applyCase, STYLES, type TextStyle } from '@/render/styles'
import { currentEdit, useProject } from '@/store/projectStore'
import { changeVoice, setTitleShow, setVoiceMode } from './editActions'

export type PanelId = 'scenes' | 'look' | 'voice' | 'music' | 'style'

const rowBase = 'flex w-full items-center gap-3 rounded-[var(--radius-card)] p-3 text-left transition duration-150 ease-ember'
const rowSel = 'bg-accent-soft shadow-[inset_0_0_0_1.5px_#ff5a1f]'
const rowIdle = 'bg-surface hover:bg-[#1a1918]'

export function ScenesPanel({ plan, timeline, project, clips, activeScene, onOpen }: { plan: EditPlan; timeline: Timeline; project: Project; clips: Clip[]; activeScene: number; onOpen: (i: number) => void }) {
  const byId = new Map(clips.map((c) => [c.id, c]))
  return (
    <ol className="space-y-2.5" aria-label="Scenes">
      {plan.scenes.map((scene, i) => {
        const ts = timeline.scenes[i]
        const first = byId.get(scene.shots[0]?.clipId)
        const line = project.script?.lines.find((l) => l.id === scene.lineId)
        const active = activeScene === i
        return (
          <li key={scene.id}>
            <button type="button" onClick={() => onOpen(i)} className={cn(rowBase, 'p-2.5 pr-4', active ? rowSel : rowIdle)} aria-current={active ? 'true' : undefined}>
              <Thumb clip={first} className="w-12 rounded-[var(--radius-thumb)]" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[15px] leading-snug font-semibold">{line?.text ?? first?.analysis?.description ?? `Scene ${i + 1}`}</span>
                <span className="mt-1.5 flex items-center gap-2 text-[13px] font-medium text-muted">
                  <span className="flex gap-[3px]" aria-hidden>
                    {scene.shots.map((sh) => (
                      <Thumb key={sh.id} clip={byId.get(sh.clipId)} className="w-[14px] rounded-[3px]" />
                    ))}
                  </span>
                  <span className="tabular">
                    {ts ? (ts.end - ts.start).toFixed(1) : '0.0'}s · {scene.shots.length} shot{scene.shots.length > 1 ? 's' : ''}
                  </span>
                  {plan.userScenes?.includes(scene.id) && (
                    <span className="flex items-center gap-1 text-ember-300" title="You picked this footage. Tell the AI keeps it.">
                      <Lock className="size-3.5" strokeWidth={2.6} /> Yours
                    </span>
                  )}
                </span>
              </span>
              <span className="tabular text-[13px] font-semibold text-faint">{i + 1}</span>
              <ChevronRight className="size-4 text-faint" strokeWidth={2.4} />
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function Thumb({ clip, className }: { clip?: Clip; className?: string }) {
  return <span className={cn('block aspect-[9/16] shrink-0 overflow-hidden bg-surface-2', className)}>{clip?.thumbnail && <img src={clip.thumbnail} alt="" className="size-full object-cover" />}</span>
}

const VOICE_MODES: { id: VoiceMode; label: string; icon: typeof Mic }[] = [
  { id: 'ai', label: 'AI voice', icon: AudioLines },
  { id: 'recorded', label: 'My own voice', icon: Mic },
  { id: 'none', label: 'No voiceover', icon: Captions },
]

/** What changes when the narration switches, in plain words. */
function switchEffects(from: VoiceMode, to: VoiceMode, takes: number): string[] {
  const kept = from === 'recorded' && takes ? [`Your ${takes} recorded take${takes === 1 ? ' is' : 's are'} kept. Switch back to My own voice to use ${takes === 1 ? 'it' : 'them'} again.`] : []
  if (to === 'ai') return ['An AI voice reads your lines; captions follow its voice.', 'Each scene re-fits to how long its line takes to say, so the timing can change.', ...kept]
  if (to === 'none') return ['No voice: your lines show as captions, timed to reading speed.', 'Scenes re-fit to that, so the timing can change.', ...kept]
  return [
    'You record over the video on the Record page, in one take or many.',
    'Captions come from what you say, so there are none until you record.',
    'The scene timing stays as it is now.',
    ...(takes ? [`Your ${takes} earlier take${takes === 1 ? ' is' : 's are'} still there.`] : []),
  ]
}

export function VoicePanel({ project }: { project: Project }) {
  const { updateProject } = useProject()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const mode = project.voice.mode
  const hasLines = !!project.script?.lines.some((l) => l.text.trim())
  const takes = project.voiceTrack?.takes.length ?? 0

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }
  // A switch is explained first, then confirmed.
  const [asking, setAsking] = useState<VoiceMode | null>(null)
  const pickMode = (m: VoiceMode) => {
    if (m === mode) {
      setAsking(null)
      if (m === 'recorded') navigate(stepPath(project.id, 'record'))
      return
    }
    setAsking(m)
  }
  const confirmSwitch = (m: VoiceMode) => {
    setAsking(null)
    void run(m, async () => {
      await setVoiceMode(m)
      if (m === 'recorded') navigate(stepPath(project.id, 'record'))
    })
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Voiceover" className="grid grid-cols-3 gap-2">
        {VOICE_MODES.map((m) => {
          const selected = m.id === mode
          const off = m.id === 'ai' && !hasLines
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!!busy || off}
              title={off ? 'Add lines in the Script step for the AI voice to read' : undefined}
              onClick={() => pickMode(m.id)}
              className={cn('flex flex-col items-center gap-1.5 rounded-[var(--radius-card)] p-3 text-[13px] font-bold transition disabled:opacity-40', selected ? rowSel : rowIdle)}
            >
              {busy === m.id ? <Spinner /> : <m.icon className="size-5" strokeWidth={2.2} />}
              {m.label}
            </button>
          )
        })}
      </div>

      {asking && (
        <div className="space-y-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/.14)]" role="alertdialog" aria-label={`Switch to ${VOICE_MODES.find((v) => v.id === asking)?.label}`}>
          <p className="text-[15px] font-semibold">Switch to {VOICE_MODES.find((v) => v.id === asking)?.label.toLowerCase()}?</p>
          <ul className="list-disc space-y-1 pl-5 text-[14px] text-muted">
            {switchEffects(mode, asking, takes).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={() => confirmSwitch(asking)} className="h-10 rounded-full bg-white px-4 text-[14px] font-bold text-ink">
              Switch
            </button>
            <button type="button" onClick={() => setAsking(null)} className="h-10 rounded-full px-4 text-[14px] font-semibold text-muted hover:text-fg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'none' && <p className="rounded-[var(--radius-card)] bg-surface p-4 text-[14px] text-muted">No voiceover: your lines show as captions. Pick AI voice or My own voice above to add one.</p>}

      {mode === 'recorded' && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4">
          <p className="min-w-0 flex-1 text-[14px] text-muted">
            {takes ? `Your own voice, ${takes} take${takes === 1 ? '' : 's'}. Re-record, move or trim it in the studio.` : 'Nothing recorded yet. Open the studio and talk over your vlog.'}
          </p>
          <Link to={stepPath(project.id, 'record')} className="flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-bold text-ink">
            Open voice studio
          </Link>
        </div>
      )}

      {mode === 'ai' && (
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {voices.map((v) => {
          const selected = project.voice.mode === 'ai' && project.voice.voiceId === v.id
          return (
            <li key={v.id}>
              <button
                type="button"
                disabled={!!busy}
                aria-pressed={selected}
                className={cn(rowBase, selected ? rowSel : rowIdle)}
                onClick={() => !selected && void run(v.id, () => changeVoice(v.id))}
              >
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-extrabold', selected ? 'bg-accent' : 'bg-surface-2')}>{v.name[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{v.name}</span>
                  <span className="block truncate text-[13px] text-muted">{v.description}</span>
                </span>
                {busy === v.id ? <Spinner /> : selected && <Check className="size-4 text-accent" strokeWidth={3} />}
              </button>
            </li>
          )
        })}
      </ul>
      )}
      {mode !== 'none' && <Slider label="Voice volume" value={project.voice.volumeDb} min={-12} max={6} onChange={(volumeDb) => updateProject((p) => ({ voice: { ...p.voice, volumeDb } }))} />}
    </div>
  )
}

export function MusicPanel({ project }: { project: Project }) {
  const { updateProject } = useProject()
  const options = [...TRACKS.map((t) => ({ id: t.id as string | null, name: t.name, description: t.description })), { id: null, name: 'No music', description: 'Voice and clip sound only' }]
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {options.map((t) => {
          const selected = project.musicTrackId === t.id
          return (
            <li key={t.id ?? 'none'}>
              <button type="button" aria-pressed={selected} onClick={() => updateProject({ musicTrackId: t.id })} className={cn(rowBase, selected ? rowSel : rowIdle)}>
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', selected ? 'bg-accent text-white' : 'bg-surface-2')}>{t.id ? <Music2 className="size-[18px]" strokeWidth={2.2} /> : <VolumeX className="size-[18px]" strokeWidth={2.2} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{t.name}</span>
                  <span className="block truncate text-[13px] text-muted">{t.description}</span>
                </span>
                {selected && <Check className="size-4 text-accent" strokeWidth={3} />}
              </button>
            </li>
          )
        })}
      </ul>
      {project.musicTrackId && <Slider label="Music volume" value={project.musicGainDb} min={-30} max={-4} onChange={(musicGainDb) => updateProject({ musicGainDb })} />}
      <p className="text-[13px] font-medium text-faint">Music dips under your voice automatically.</p>
    </div>
  )
}

const TITLE_SHOW: { value: number | 'always'; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 3, label: 'First 3 s' },
  { value: 'always', label: 'Whole video' },
]

export function StylePanel({ project, clips }: { project: Project; clips: Clip[] }) {
  const { updateProject } = useProject()
  const sample = clips.find((c) => c.thumbnail)?.thumbnail
  const show = currentEdit(project)?.title.showUntilSec ?? 3
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="vlog-title" className="block text-[15px] font-semibold">
          Title
        </label>
        <TextInput id="vlog-title" value={project.title} maxLength={40} disabled={show === 0} onChange={(e) => updateProject({ title: e.target.value })} placeholder="My Day" />
        <div role="radiogroup" aria-label="Show the title" className="flex flex-wrap gap-1.5">
          {TITLE_SHOW.map((o) => {
            const on = o.value === 0 ? show === 0 : o.value === 'always' ? show === 'always' : show !== 0 && show !== 'always'
            return (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => !on && void setTitleShow(o.value).catch((e: Error) => toast(e.message, 'error'))}
                className={cn('h-9 rounded-full px-4 text-[14px] font-semibold transition', on ? 'bg-white text-ink' : 'bg-surface-2 text-muted hover:text-fg')}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-2">
        <span className="block text-[15px] font-semibold">Captions</span>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {STYLES.map((s) => (
            <PresetCard key={s.id} style={s} selected={project.styleId === s.id} image={sample} onClick={() => updateProject({ styleId: s.id })} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PresetCard({ style, selected, image, onClick }: { style: TextStyle; selected: boolean; image?: string; onClick: () => void }) {
  const o = style.outline
  const textShadow = o ? (o.strength === 'heavy' ? '0 0 2px #000,0 0 3px #000,0 2px 6px rgba(0,0,0,.95)' : o.strength === 'normal' ? '0 0 2px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.85)' : '0 1px 8px rgba(0,0,0,.45)') : 'none'
  const words = ['so', 'here’s', 'a', 'sunny'].map((w) => applyCase(w, style.captionCase))
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn('overflow-hidden rounded-[var(--radius-card)] bg-surface text-left transition', selected ? 'shadow-[inset_0_0_0_1.5px_#ff5a1f,0_0_0_1.5px_#ff5a1f]' : 'hover:bg-[#1a1918]')}>
      <span className="relative grid h-[92px] place-items-center overflow-hidden bg-[linear-gradient(170deg,#f4dcae_0%,#d9a55e_28%,#6f7d3c_62%,#1c2414_100%)]">
        {image && <img src={image} alt="" className="absolute inset-0 size-full object-cover opacity-80" />}
        <span
          className="relative rounded-[.35em] px-[.42em] py-[.12em] text-[15px]"
          style={{ fontWeight: style.weight, color: style.box ? style.captionColor : '#fff', background: style.box ?? undefined, textShadow }}
        >
          {words.slice(0, 3).join(' ')} <span style={{ color: style.highlightColor }}>{words[3]}</span>
        </span>
      </span>
      <span className="flex items-center gap-2 p-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">{style.name}</span>
          <span className="block truncate text-[12px] text-muted">{style.description}</span>
        </span>
        {selected && <Check className="size-4 shrink-0 text-accent" strokeWidth={3} />}
      </span>
    </button>
  )
}

export function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface px-4 py-3 text-[15px]">
      <span className="w-28 shrink-0 font-semibold">{label}</span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 flex-1" />
    </label>
  )
}
