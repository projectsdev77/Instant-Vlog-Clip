import { useState } from 'react'
import { Check, ChevronRight, Music2, VolumeX } from 'lucide-react'
import { voices } from '@/ai'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import type { Clip, EditPlan, Project } from '@/domain/types'
import type { Timeline } from '@/domain/timeline'
import { cn } from '@/lib/cn'
import { TRACKS } from '@/render/musicTracks'
import { applyCase, STYLES, type TextStyle } from '@/render/styles'
import { useProject } from '@/store/projectStore'
import { changeVoice } from './editActions'

export type PanelId = 'scenes' | 'voice' | 'music' | 'style'

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

export function VoicePanel({ project }: { project: Project }) {
  const { updateProject } = useProject()
  const [busy, setBusy] = useState<string | null>(null)
  if (project.voice.mode === 'none') return <p className="rounded-[var(--radius-card)] bg-surface p-4 text-muted">This vlog has no voiceover. Your lines show as captions. Pick a voice in the Voice step to add one.</p>
  return (
    <div className="space-y-4">
      {project.voice.mode === 'recorded' && <p className="text-[14px] text-muted">You’re using your own recordings. Pick a voice below to switch to AI.</p>}
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
                onClick={async () => {
                  if (selected) return
                  setBusy(v.id)
                  try {
                    await changeVoice(v.id)
                  } catch (e) {
                    toast((e as Error).message, 'error')
                  } finally {
                    setBusy(null)
                  }
                }}
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
      <Slider label="Voice volume" value={project.voice.volumeDb} min={-12} max={6} onChange={(volumeDb) => updateProject((p) => ({ voice: { ...p.voice, volumeDb } }))} />
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

export function StylePanel({ project, clips }: { project: Project; clips: Clip[] }) {
  const { updateProject } = useProject()
  const sample = clips.find((c) => c.thumbnail)?.thumbnail
  return (
    <div className="space-y-5">
      <label className="block space-y-2">
        <span className="block text-[15px] font-semibold">Title</span>
        <TextInput value={project.title} maxLength={40} onChange={(e) => updateProject({ title: e.target.value })} placeholder="My Day" />
        <span className="block text-[13px] font-medium text-faint">Shows for the first 3 seconds.</span>
      </label>
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
