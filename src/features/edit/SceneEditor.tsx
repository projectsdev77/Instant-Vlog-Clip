import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import { rankedMoments } from '@/domain/moments'
import type { Clip, ClipAudioMode, EditPlan, Moment, Project, Shot } from '@/domain/types'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import { deleteScene, editLine, moveScene, setShotAudio, swapShot, trimShot, undo } from './editActions'
import { Thumb } from './GlobalPanels'

type Props = { project: Project; plan: EditPlan; clips: Clip[]; index: number; onClose: () => void; onIndex: (i: number) => void }

/** Edits one scene in place of the tabs, so the preview stays visible. */
export function SceneEditor({ project, plan, clips, index, onClose, onIndex }: Props) {
  const scene = plan.scenes[index]
  const line = project.script?.lines.find((l) => l.id === scene?.lineId)
  const [text, setText] = useState(line?.text ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const byId = new Map(clips.map((c) => [c.id, c]))
  if (!scene) return null

  const act = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-6" aria-label={`Scene ${index + 1}`}>
      <div className="flex items-center justify-between gap-3">
        <Button variant="text" size="sm" className="-ml-3" onClick={onClose}>
          <ChevronLeft className="size-5" strokeWidth={2.4} /> All scenes
        </Button>
        <span className="tabular text-[14px] font-semibold text-muted">
          Scene {index + 1} of {plan.scenes.length}
        </span>
      </div>

      {line && (
        <div className="space-y-2">
          <label htmlFor="scene-line" className="block text-[15px] font-semibold">
            Narration
          </label>
          <div className="flex gap-2">
            <TextInput
              id="scene-line"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && text.trim() && text.trim() !== line.text && act('line', () => editLine(line.id, text.trim()))}
            />
            {text.trim() !== line.text && (
              <Button disabled={!!busy || !text.trim()} onClick={() => act('line', () => editLine(line.id, text.trim()))}>
                {busy === 'line' ? <Spinner /> : 'Save'}
              </Button>
            )}
          </div>
          <p className="text-[13px] font-medium text-faint">
            {project.voice.mode === 'recorded' ? 'Re-record this line in the Voice step after changing it.' : 'Changing this re-voices just this line.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-[15px] font-semibold">Shots</h3>
        {scene.shots.map((shot, si) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            n={si + 1}
            clip={byId.get(shot.clipId)}
            clips={clips}
            busy={busy}
            onAudio={(m) => act('audio', () => setShotAudio(index, si, m))}
            onSwap={(c, m) => act('swap', () => swapShot(index, si, c.id, m))}
            onTrim={(a, b) => act('trim', () => trimShot(index, si, a, b))}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-5">
        <Button variant="quiet" size="sm" disabled={index === 0 || !!busy} onClick={() => act('move', async () => { await moveScene(index, index - 1); onIndex(index - 1) })}>
          <ArrowUp className="size-4" strokeWidth={2.4} /> Move earlier
        </Button>
        <Button variant="quiet" size="sm" disabled={index === plan.scenes.length - 1 || !!busy} onClick={() => act('move', async () => { await moveScene(index, index + 1); onIndex(index + 1) })}>
          <ArrowDown className="size-4" strokeWidth={2.4} /> Move later
        </Button>
        <Button
          variant="text"
          size="sm"
          className="ml-auto text-danger"
          disabled={!!busy || plan.scenes.length <= 1}
          onClick={() =>
            act('delete', async () => {
              await deleteScene(index)
              onClose()
              toast(`Scene ${index + 1} deleted.`, 'info', { label: 'Undo', run: () => void undo() })
            })
          }
        >
          <Trash2 className="size-4" strokeWidth={2.4} /> Delete scene
        </Button>
      </div>
    </section>
  )
}

const SOUND: { id: ClipAudioMode; label: string }[] = [
  { id: 'mute', label: 'Off' },
  { id: 'duck', label: 'Quiet' },
  { id: 'full', label: 'Full' },
]

function ShotCard(props: { shot: Shot; n: number; clip?: Clip; clips: Clip[]; busy: string | null; onAudio: (m: ClipAudioMode) => void; onSwap: (c: Clip, m: Moment) => void; onTrim: (a: number, b: number) => void }) {
  const { shot, clip } = props
  return (
    <div className="space-y-4 rounded-[var(--radius-panel)] bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Thumb clip={clip} className="w-10 rounded-[var(--radius-thumb)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">Shot {props.n}</div>
          <div className="tabular text-[13px] font-medium whitespace-nowrap text-muted">
            {formatDuration(shot.in)}–{formatDuration(shot.out)} · {(shot.out - shot.in).toFixed(1)}s
          </div>
        </div>
        <div className="flex basis-full items-center justify-between gap-2 sm:basis-auto">
          <span className="text-[13px] font-semibold text-muted">Clip sound</span>
          <div className="flex rounded-full bg-surface-2 p-1" role="radiogroup" aria-label="Clip sound">
            {SOUND.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={shot.clipAudio === s.id}
                onClick={() => props.onAudio(s.id)}
                className={cn('h-9 rounded-full px-3 text-[13px] font-semibold transition', shot.clipAudio === s.id ? 'bg-white text-ink' : 'text-muted hover:text-fg')}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Alternatives clips={props.clips} current={shot} busy={props.busy === 'swap'} onPick={props.onSwap} />
      {clip && <Trimmer key={`${shot.in}-${shot.out}`} clip={clip} shot={shot} onApply={props.onTrim} />}
    </div>
  )
}

function Alternatives({ clips, current, busy, onPick }: { clips: Clip[]; current: Shot; busy: boolean; onPick: (c: Clip, m: Moment) => void }) {
  const currentClip = clips.find((c) => c.id === current.clipId)
  const options = useMemo(
    () =>
      clips
        .filter((c) => c.status !== 'error' && c.durationSec > 0)
        .flatMap((c) => rankedMoments(c).map((m) => ({ c, m })))
        .filter(({ c, m }) => !(c.id === current.clipId && m.start < current.out && m.end > current.in))
        .sort((a, b) => b.m.score - a.m.score)
        .slice(0, 5),
    [clips, current],
  )
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold">Swap for another good moment {busy && <Spinner className="size-3.5" />}</div>
      <ul className="grid grid-cols-6 gap-2">
        <li>
          <span className="block overflow-hidden rounded-[var(--radius-thumb)] shadow-[0_0_0_2px_#ff5a1f]" aria-label="Current shot">
            <Thumb clip={currentClip} className="w-full" />
          </span>
        </li>
        {options.map(({ c, m }) => (
          <li key={`${c.id}-${m.start}`}>
            <button type="button" disabled={busy} onClick={() => onPick(c, m)} className="block w-full overflow-hidden rounded-[var(--radius-thumb)] transition hover:opacity-80" aria-label={`Use ${formatDuration(m.start)} to ${formatDuration(m.end)} of ${c.fileName}`}>
              <Thumb clip={c} className="w-full" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Trimmer({ clip, shot, onApply }: { clip: Clip; shot: Shot; onApply: (a: number, b: number) => void }) {
  const [a, setA] = useState(shot.in)
  const [b, setB] = useState(shot.out)
  const dur = clip.durationSec
  const minLen = Math.max(0.5, (shot.out - shot.in) * 0.1)
  const changed = Math.abs(a - shot.in) > 0.01 || Math.abs(b - shot.out) > 0.01
  return (
    <div className="space-y-2">
      <div className="text-[14px] font-semibold">Trim</div>
      <div className="relative h-2 rounded-full bg-white/10">
        <div className="absolute inset-y-0 rounded-full bg-accent" style={{ left: `${(a / dur) * 100}%`, width: `${((b - a) / dur) * 100}%` }} />
      </div>
      <label className="flex items-center gap-3 text-[13px] font-medium">
        <span className="w-10 text-muted">Start</span>
        <input type="range" min={0} max={dur} step={0.05} value={a} onChange={(e) => setA(Math.min(Number(e.target.value), b - minLen))} className="h-9 flex-1" />
        <span className="tabular w-11 text-right">{a.toFixed(1)}s</span>
      </label>
      <label className="flex items-center gap-3 text-[13px] font-medium">
        <span className="w-10 text-muted">End</span>
        <input type="range" min={0} max={dur} step={0.05} value={b} onChange={(e) => setB(Math.max(Number(e.target.value), a + minLen))} className="h-9 flex-1" />
        <span className="tabular w-11 text-right">{b.toFixed(1)}s</span>
      </label>
      {changed && (
        <Button size="sm" onClick={() => onApply(a, b)}>
          Apply trim
        </Button>
      )}
    </div>
  )
}
