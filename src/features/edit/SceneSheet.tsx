import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Repeat, Scissors, Trash2, Volume2, VolumeX, Volume1 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { AutoTextarea } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import { rankedMoments } from '@/domain/moments'
import type { Clip, EditPlan, Project, Shot } from '@/domain/types'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import { deleteScene, editLine, moveScene, setShotAudio, swapShot, trimShot } from './editActions'

type Props = { project: Project; plan: EditPlan; clips: Clip[]; index: number; onClose: () => void }

export function SceneSheet({ project, plan, clips, index, onClose }: Props) {
  const scene = plan.scenes[index]
  const line = project.script?.lines.find((l) => l.id === scene?.lineId)
  const [text, setText] = useState(line?.text ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [panel, setPanel] = useState<{ kind: 'swap' | 'trim'; shot: number } | null>(null)
  if (!scene) return null
  const clipById = new Map(clips.map((c) => [c.id, c]))

  const act = async (label: string, fn: () => Promise<void>, close = false) => {
    setBusy(label)
    try {
      await fn()
      if (close) onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open title={`Scene ${index + 1}`} onClose={onClose}>
      <div className="space-y-5">
        {line && (
          <section className="space-y-2">
            <label className="text-sm font-medium" htmlFor="scene-line">
              Narration
            </label>
            <AutoTextarea id="scene-line" value={text} onChange={(e) => setText(e.target.value.replace(/\n/g, ' '))} />
            {text.trim() !== line.text && (
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={!!busy || !text.trim()} onClick={() => act('line', () => editLine(line.id, text.trim()))}>
                  {busy === 'line' && <Spinner />} {project.voice.mode === 'ai' ? 'Save & re-voice' : 'Save'}
                </Button>
                {project.voice.mode === 'recorded' && <span className="text-xs text-muted">You'll need to re-record this line.</span>}
              </div>
            )}
          </section>
        )}

        <section className="space-y-2">
          <div className="text-sm font-medium">Shots</div>
          <ul className="space-y-2">
            {scene.shots.map((shot, si) => {
              const clip = clipById.get(shot.clipId)
              return (
                <li key={shot.id} className="rounded-[var(--radius-control)] border border-border p-2">
                  <div className="flex items-center gap-3">
                    {clip?.thumbnail ? <img src={clip.thumbnail} alt="" className="h-14 w-10 rounded object-cover" /> : <div className="h-14 w-10 rounded bg-surface-2" />}
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="truncate font-medium">{clip?.analysis?.description ?? clip?.fileName}</div>
                      <div className="text-xs text-muted">
                        {formatDuration(shot.in)}–{formatDuration(shot.out)} · {(shot.out - shot.in).toFixed(1)}s
                      </div>
                    </div>
                    <AudioToggle shot={shot} onChange={(m) => act('audio', () => setShotAudio(index, si, m))} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant={panel?.kind === 'swap' && panel.shot === si ? 'primary' : 'secondary'} onClick={() => setPanel(panel?.kind === 'swap' && panel.shot === si ? null : { kind: 'swap', shot: si })}>
                      <Repeat className="size-4" /> Swap
                    </Button>
                    <Button size="sm" variant={panel?.kind === 'trim' && panel.shot === si ? 'primary' : 'secondary'} onClick={() => setPanel(panel?.kind === 'trim' && panel.shot === si ? null : { kind: 'trim', shot: si })}>
                      <Scissors className="size-4" /> Trim
                    </Button>
                  </div>
                  {panel?.shot === si && panel.kind === 'swap' && (
                    <Alternatives clips={clips} current={shot} busy={busy === 'swap'} onPick={(c, m) => act('swap', () => swapShot(index, si, c.id, m))} />
                  )}
                  {panel?.shot === si && panel.kind === 'trim' && clip && <Trimmer clip={clip} shot={shot} narrated={!!line} onApply={(a, b) => act('trim', () => trimShot(index, si, a, b))} />}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button size="sm" variant="secondary" disabled={index === 0 || !!busy} onClick={() => act('move', () => moveScene(index, index - 1), true)}>
            <ArrowLeft className="size-4" /> Earlier
          </Button>
          <Button size="sm" variant="secondary" disabled={index === plan.scenes.length - 1 || !!busy} onClick={() => act('move', () => moveScene(index, index + 1), true)}>
            Later <ArrowRight className="size-4" />
          </Button>
          <Button size="sm" variant="danger" className="ml-auto" disabled={!!busy || plan.scenes.length <= 1} onClick={() => act('delete', () => deleteScene(index), true)}>
            <Trash2 className="size-4" /> Delete scene
          </Button>
        </section>
      </div>
    </Sheet>
  )
}

function AudioToggle({ shot, onChange }: { shot: Shot; onChange: (m: Shot['clipAudio']) => void }) {
  const order: Shot['clipAudio'][] = ['mute', 'duck', 'full']
  const next = order[(order.indexOf(shot.clipAudio) + 1) % order.length]
  const Icon = shot.clipAudio === 'mute' ? VolumeX : shot.clipAudio === 'duck' ? Volume1 : Volume2
  const label = { mute: 'Clip sound off', duck: 'Clip sound quiet', full: 'Clip sound full' }[shot.clipAudio]
  return (
    <button type="button" onClick={() => onChange(next)} className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1.5 text-xs" aria-label={`${label}. Tap to change.`}>
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function Alternatives({ clips, current, busy, onPick }: { clips: Clip[]; current: Shot; busy: boolean; onPick: (c: Clip, m: ReturnType<typeof rankedMoments>[number]) => void }) {
  const options = useMemo(
    () =>
      clips
        .filter((c) => c.status !== 'error' && c.durationSec > 0)
        .flatMap((c) => rankedMoments(c).map((m) => ({ c, m })))
        .filter(({ c, m }) => !(c.id === current.clipId && m.start < current.out && m.end > current.in))
        .sort((a, b) => b.m.score - a.m.score)
        .slice(0, 12),
    [clips, current],
  )
  return (
    <div className="mt-3">
      <div className="mb-2 text-xs text-muted">Pick another moment {busy && <Spinner className="ml-1 inline size-3" />}</div>
      <ul className="grid grid-cols-4 gap-2">
        {options.map(({ c, m }) => (
          <li key={`${c.id}-${m.start}`}>
            <button type="button" disabled={busy} onClick={() => onPick(c, m)} className="block w-full text-left">
              {c.thumbnail ? <img src={c.thumbnail} alt="" className="aspect-[9/16] w-full rounded object-cover" /> : <div className="aspect-[9/16] rounded bg-surface-2" />}
              <span className="mt-0.5 block truncate text-[11px] text-muted">
                {formatDuration(m.start)}–{formatDuration(m.end)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Trimmer({ clip, shot, narrated, onApply }: { clip: Clip; shot: Shot; narrated: boolean; onApply: (a: number, b: number) => void }) {
  const [a, setA] = useState(shot.in)
  const [b, setB] = useState(shot.out)
  const dur = clip.durationSec
  const changed = Math.abs(a - shot.in) > 0.01 || Math.abs(b - shot.out) > 0.01
  return (
    <div className="mt-3 space-y-2">
      <div className="relative h-8 rounded bg-surface-2">
        <div className="absolute inset-y-0 rounded bg-accent/30" style={{ left: `${(a / dur) * 100}%`, width: `${((b - a) / dur) * 100}%` }} />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <span className="w-10 text-muted">Start</span>
        <input type="range" min={0} max={dur} step={0.05} value={a} onChange={(e) => setA(Math.min(Number(e.target.value), b - 0.5))} className={cn('flex-1 accent-[var(--color-accent)]')} />
        <span className="w-10 text-right tabular-nums">{a.toFixed(1)}s</span>
      </label>
      <label className="flex items-center gap-2 text-xs">
        <span className="w-10 text-muted">End</span>
        <input type="range" min={0} max={dur} step={0.05} value={b} onChange={(e) => setB(Math.max(Number(e.target.value), a + 0.5))} className="flex-1 accent-[var(--color-accent)]" />
        <span className="w-10 text-right tabular-nums">{b.toFixed(1)}s</span>
      </label>
      {narrated && <p className="text-xs text-muted">The scene stays as long as its line; other shots adjust to fit.</p>}
      <Button size="sm" disabled={!changed} onClick={() => onApply(a, b)}>
        Apply trim
      </Button>
    </div>
  )
}
