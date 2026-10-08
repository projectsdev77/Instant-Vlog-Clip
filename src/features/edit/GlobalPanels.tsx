import { useState } from 'react'
import { Check, Music2 } from 'lucide-react'
import { voices } from '@/ai'
import { Chip } from '@/components/ui/Chip'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import type { Project, StyleId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { TRACKS } from '@/render/musicTracks'
import { STYLES } from '@/render/styles'
import { useProject } from '@/store/projectStore'
import { changeVoice } from './editActions'

export type PanelId = 'scenes' | 'voice' | 'music' | 'style'

export function VoicePanel({ project }: { project: Project }) {
  const { updateProject } = useProject()
  const [busy, setBusy] = useState<string | null>(null)
  if (project.voice.mode === 'none') return <p className="text-sm text-muted">This vlog has no voiceover. Change it in the Voice step.</p>
  return (
    <div className="space-y-4">
      {project.voice.mode === 'ai' ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {voices.map((v) => (
            <Chip
              key={v.id}
              selected={project.voice.voiceId === v.id}
              disabled={!!busy}
              onClick={async () => {
                if (v.id === project.voice.voiceId) return
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
              {busy === v.id && <Spinner className="mr-1 inline size-3" />}
              {v.name}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Using your own recordings. Re-record lines in the Voice step.</p>
      )}
      <Slider label="Voice volume" value={project.voice.volumeDb} min={-12} max={6} onChange={(volumeDb) => updateProject((p) => ({ voice: { ...p.voice, volumeDb } }))} />
    </div>
  )
}

export function MusicPanel({ project }: { project: Project }) {
  const { updateProject } = useProject()
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[{ id: null, name: 'No music', vibes: [] as string[] }, ...TRACKS].map((t) => {
          const selected = project.musicTrackId === t.id
          return (
            <li key={t.id ?? 'none'}>
              <button
                type="button"
                onClick={() => updateProject({ musicTrackId: t.id })}
                className={cn('flex w-full items-center gap-2 rounded-[var(--radius-control)] border p-2.5 text-left text-sm', selected ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface')}
              >
                <Music2 className={cn('size-4 shrink-0', selected ? 'text-accent' : 'text-muted')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  {t.vibes.length > 0 && <span className="block truncate text-xs text-muted capitalize">{t.vibes.filter((v) => v !== 'auto').join(', ')}</span>}
                </span>
                {selected && <Check className="size-4 text-accent" />}
              </button>
            </li>
          )
        })}
      </ul>
      {project.musicTrackId && <Slider label="Music volume" value={project.musicGainDb} min={-30} max={-4} onChange={(musicGainDb) => updateProject({ musicGainDb })} />}
      <p className="text-xs text-muted">Music gets quieter automatically while someone is talking.</p>
    </div>
  )
}

export function StylePanel({ project }: { project: Project }) {
  const { updateProject } = useProject()
  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Title</span>
        <TextInput value={project.title} maxLength={40} onChange={(e) => updateProject({ title: e.target.value })} placeholder="My Day" />
      </label>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Captions</span>
        <div className="grid grid-cols-4 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => updateProject({ styleId: s.id as StyleId })}
              className={cn('grid aspect-square place-items-center rounded-[var(--radius-control)] bg-neutral-800 p-1 text-center', project.styleId === s.id && 'ring-2 ring-accent')}
              aria-pressed={project.styleId === s.id}
            >
              <span
                style={{ fontWeight: s.weight, color: s.captionColor, background: s.box ?? undefined, textShadow: s.box ? undefined : `0 0 3px ${s.stroke}`, textTransform: s.uppercaseCaptions ? 'uppercase' : undefined }}
                className="rounded px-1 text-xs leading-tight"
              >
                {s.name} <span style={{ color: s.highlightColor }}>Aa</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 font-medium">{label}</span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--color-accent)]" />
    </label>
  )
}
