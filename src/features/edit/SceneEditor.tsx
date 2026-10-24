import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, Copy, Lock, LockOpen, Plus, RotateCcw, Scissors, Snowflake, Trash2, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import { rankedMoments } from '@/domain/moments'
import type { Clip, ClipAudioMode, Delivery, EditPlan, Fit, Moment, Motion, Project, Ramp, Shot, Transition } from '@/domain/types'
import type { Timeline } from '@/domain/timeline'
import { shotLength } from '@/domain/shots'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  addLine,
  DELIVERY_LABEL,
  deleteScene,
  deleteShot,
  duplicateShot,
  editLine,
  freezeFrame,
  moveScene,
  lockScene,
  releaseScene,
  rereadLine,
  setLineMuted,
  setShotAudio,
  setShotSpeed,
  setShotVolume,
  splitShot,
  swapShot,
  trimShot,
  undo,
  updateShot,
} from './editActions'

const DELIVERIES: Delivery[] = ['natural', 'calm', 'energetic', 'slow']

/** A button that opens a one-line field for a new line of narration. */
function AddLine({ label, busy, onAdd }: { label: string; busy: boolean; onAdd: (text: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open)
    return (
      <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" strokeWidth={2.4} /> {label}
      </Button>
    )
  const submit = () => {
    if (!text.trim() || busy) return
    void onAdd(text.trim()).then(() => {
      setText('')
      setOpen(false)
    })
  }
  return (
    <div className="space-y-2">
      <label htmlFor="new-line" className="block text-[15px] font-semibold">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[220px] flex-1">
          <TextInput id="new-line" autoFocus value={text} placeholder="What should it say?" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        <div className="flex gap-2">
          <Button className="min-w-[96px]" disabled={busy || !text.trim()} onClick={submit}>
            {busy ? <Spinner /> : 'Add'}
          </Button>
          <Button variant="text" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
import { Thumb } from './GlobalPanels'

type Props = { project: Project; plan: EditPlan; clips: Clip[]; index: number; onClose: () => void; onIndex: (i: number) => void; timeline: Timeline; now: number }

/** Edits one scene in place of the tabs, so the preview stays visible. */
export function SceneEditor({ project, plan, clips, index, onClose, onIndex, timeline, now }: Props) {
  const scene = plan.scenes[index]
  const line = project.script?.lines.find((l) => l.id === scene?.lineId)
  const [text, setText] = useState(line?.text ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const locked = !!scene && !!plan.userScenes?.includes(scene.id)
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
        <div className="flex items-center gap-3">
          <span className="tabular text-[14px] font-semibold whitespace-nowrap text-muted">
            <span className="max-sm:hidden">Scene </span>
            {index + 1} of {plan.scenes.length}
          </span>
          {/* Locked scenes stay as they are when the AI edits; changing a shot by hand locks the scene. */}
          <button
            type="button"
            aria-pressed={locked}
            disabled={!!busy}
            title={locked ? 'The AI won’t change this scene. Tap to unlock.' : 'Keep this scene as it is when you ask the AI for changes.'}
            onClick={() => act(locked ? 'release' : 'lock', () => (locked ? releaseScene(scene.id) : lockScene(scene.id)))}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold whitespace-nowrap transition',
              locked ? 'bg-accent-soft text-ember-300 shadow-[inset_0_0_0_1.5px_#ff5a1f]' : 'bg-surface text-muted hover:text-fg',
            )}
          >
            {locked ? <Lock className="size-3.5" strokeWidth={2.6} /> : <LockOpen className="size-3.5" strokeWidth={2.6} />}
            {locked ? 'Locked from AI' : 'Lock from AI'}
          </button>
        </div>
      </div>

      {line && (
        <div className="space-y-2">
          <label htmlFor="scene-line" className="block text-[15px] font-semibold">
            Narration
          </label>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[220px] flex-1">
              <TextInput
                id="scene-line"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && text.trim() && text.trim() !== line.text && act('line', () => editLine(line.id, text.trim()))}
              />
            </div>
            {text.trim() !== line.text && (
              <Button className="min-w-[96px]" disabled={!!busy || !text.trim()} onClick={() => act('line', () => editLine(line.id, text.trim()))}>
                {busy === 'line' ? <Spinner /> : 'Save'}
              </Button>
            )}
          </div>
          <p className="text-[13px] font-medium text-faint">
            {project.voice.mode === 'ai' && !line.muted
              ? 'Changing this re-voices just this line.'
              : project.voice.mode === 'recorded'
                ? 'Your recording stays as it is. Re-record in the voice studio if you want it to match.'
                : 'This changes the caption.'}
          </p>
        </div>
      )}

      {!line && <AddLine label="Add a line to this scene" busy={busy === 'add'} onAdd={(t) => act('add', async () => onIndex(await addLine(index, t)))} />}

      {line && project.voice.mode === 'ai' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Voice</span>
            <Button size="sm" variant="quiet" disabled={!!busy} onClick={() => act('mute', () => setLineMuted(line.id, !line.muted))}>
              {busy === 'mute' ? <Spinner /> : line.muted ? <Volume2 className="size-4" strokeWidth={2.4} /> : <VolumeX className="size-4" strokeWidth={2.4} />}
              {line.muted ? 'Turn voice on' : 'Mute voice'}
            </Button>
          </div>
          {line.muted ? (
            <p className="text-[13px] font-medium text-faint">The AI voice skips this line. It still shows as a caption.</p>
          ) : (
            <Segs label="Read it">
              {DELIVERIES.map((d) => (
                <Seg key={d} on={(line.delivery ?? 'natural') === d} disabled={!!busy} onClick={() => act('read', () => rereadLine(line.id, d))}>
                  {DELIVERY_LABEL[d]}
                </Seg>
              ))}
              <Seg on={false} disabled={!!busy} onClick={() => act('read', () => rereadLine(line.id, line.delivery ?? 'natural'))}>
                <span className="flex items-center gap-1.5">
                  {busy === 'read' ? <Spinner className="size-3.5" /> : <RotateCcw className="size-3.5" strokeWidth={2.6} />} Read again
                </span>
              </Seg>
            </Segs>
          )}
        </div>
      )}

      {line && <AddLine label="Add a line after this scene" busy={busy === 'add'} onAdd={(t) => act('add', async () => onIndex(await addLine(index, t)))} />}

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
            tools={{
              busy: !!busy,
              playheadLocal: playheadIn(timeline, now, shot.id),
              onSplit: (at) => act('tool', () => splitShot(index, si, at)),
              onFreeze: (at) => act('tool', () => freezeFrame(index, si, at)),
              onDuplicate: () =>
                act('tool', async () => {
                  await duplicateShot(index, si)
                  toast(`Added a copy as scene ${index + 2}.`, 'info', { label: 'Undo', run: () => void undo() })
                }),
              onDelete: () =>
                act('tool', async () => {
                  const last = scene.shots.length <= 1
                  await deleteShot(index, si)
                  if (last) onClose()
                  toast(last ? 'Scene deleted.' : 'Shot deleted.', 'info', { label: 'Undo', run: () => void undo() })
                }),
              onSpeed: (speed, ramp) => act('tool', () => setShotSpeed(index, si, speed, ramp)),
              onPatch: (patch, note) => act('tool', () => updateShot(index, si, patch, note)),
              onVolume: (v) => void setShotVolume(index, si, v),
              first: index === 0 && si === 0,
              fit: plan.look?.fit ?? 'fill',
            }}
          />
        ))}
      </div>

      <div className="space-y-1 border-t border-border pt-5">
        <h3 className="text-[15px] font-semibold">Scene order</h3>
        <p className="text-[13px] text-faint">This plays as scene {index + 1} of {plan.scenes.length}. Swap it with the scene before or after it.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" size="sm" disabled={index === 0 || !!busy} onClick={() => act('move', async () => { await moveScene(index, index - 1); onIndex(index - 1) })}>
          <ArrowUp className="size-4" strokeWidth={2.4} /> {index === 0 ? 'Already first' : `Play before scene ${index}`}
        </Button>
        <Button variant="quiet" size="sm" disabled={index === plan.scenes.length - 1 || !!busy} onClick={() => act('move', async () => { await moveScene(index, index + 1); onIndex(index + 1) })}>
          <ArrowDown className="size-4" strokeWidth={2.4} /> {index === plan.scenes.length - 1 ? 'Already last' : `Play after scene ${index + 2}`}
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

/** Playhead position inside a shot, seconds, if the playhead is on it. */
function playheadIn(tl: Timeline, now: number, shotId: string): number | undefined {
  const ts = tl.shots.find((x) => x.shot.id === shotId)
  return ts && now >= ts.start && now < ts.end ? now - ts.start : undefined
}

type Tools = {
  busy: boolean
  playheadLocal?: number
  first: boolean
  fit: Fit
  onSplit: (at?: number) => void
  onFreeze: (at?: number) => void
  onDuplicate: () => void
  onDelete: () => void
  onSpeed: (speed: number, ramp?: Ramp) => void
  onPatch: (patch: Partial<Shot>, note: string) => void
  onVolume: (v: number) => void
}

function ShotCard(props: { shot: Shot; n: number; clip?: Clip; clips: Clip[]; busy: string | null; onAudio: (m: ClipAudioMode) => void; onSwap: (c: Clip, m: Moment) => void; onTrim: (a: number, b: number) => void; tools: Tools }) {
  const { shot, clip } = props
  return (
    <div className="space-y-4 rounded-[var(--radius-panel)] bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Thumb clip={clip} className="w-10 rounded-[var(--radius-thumb)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">Shot {props.n}</div>
          <div className="tabular text-[13px] font-medium whitespace-nowrap text-muted">
            {shot.hold ? `Freeze frame at ${formatDuration(shot.in)}` : `${formatDuration(shot.in)}–${formatDuration(shot.out)}`} · {shotLength(shot).toFixed(1)}s
            {shot.speed && shot.speed !== 1 ? ` · ${shot.speed}×` : ''}
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
      <ShotTools shot={shot} t={props.tools} />
      <Alternatives clips={props.clips} current={shot} busy={props.busy === 'swap'} onPick={props.onSwap} />
      {clip && !shot.hold && <Trimmer key={`${shot.in}-${shot.out}`} clip={clip} shot={shot} onApply={props.onTrim} />}
    </div>
  )
}

const SPEEDS = [0.5, 1, 1.5, 2, 3]
const RAMP_OPTIONS: { id: Ramp; label: string }[] = [
  { id: 'montage', label: 'Montage' },
  { id: 'hero', label: 'Hero' },
  { id: 'bullet', label: 'Bullet' },
]
const MOTION_OPTIONS: { id: Motion; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'zoomIn', label: 'Zoom in' },
  { id: 'zoomOut', label: 'Zoom out' },
  { id: 'panLeft', label: 'Pan left' },
  { id: 'panRight', label: 'Pan right' },
  { id: 'punch', label: 'Punch' },
  { id: 'shake', label: 'Shake' },
]
const TRANSITION_OPTIONS: { id: Transition; label: string }[] = [
  { id: 'cut', label: 'Cut' },
  { id: 'crossfade', label: 'Fade' },
  { id: 'dip', label: 'Dip' },
  { id: 'whip', label: 'Whip' },
  { id: 'slide', label: 'Slide' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'flash', label: 'Flash' },
  { id: 'blur', label: 'Blur' },
]

/** CapCut-style tools for one shot. */
function ShotTools({ shot, t }: { shot: Shot; t: Tools }) {
  const ramp = shot.ramp ?? 'none'
  const speed = shot.speed ?? 1
  return (
    <div className="space-y-3.5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Shot tools">
        <ToolButton disabled={t.busy} onClick={() => t.onSplit(t.playheadLocal)} icon={<Scissors className="size-4" strokeWidth={2.4} />} label="Split" hint={t.playheadLocal !== undefined ? 'at the playhead' : 'in the middle'} />
        <ToolButton disabled={t.busy} onClick={() => t.onFreeze(t.playheadLocal)} icon={<Snowflake className="size-4" strokeWidth={2.4} />} label="Freeze" />
        <ToolButton disabled={t.busy} onClick={t.onDuplicate} icon={<Copy className="size-4" strokeWidth={2.4} />} label="Duplicate" />
        <ToolButton disabled={t.busy} onClick={t.onDelete} icon={<Trash2 className="size-4" strokeWidth={2.4} />} label="Delete" danger />
      </div>
      {!shot.hold && (
        <Segs label="Speed">
          {SPEEDS.map((x) => (
            <Seg key={x} on={ramp === 'none' && speed === x} disabled={t.busy} onClick={() => t.onSpeed(x)}>
              {x}×
            </Seg>
          ))}
          {RAMP_OPTIONS.map((r) => (
            <Seg key={r.id} on={ramp === r.id} disabled={t.busy} onClick={() => t.onSpeed(1, r.id)}>
              {r.label}
            </Seg>
          ))}
        </Segs>
      )}
      <Segs label="Camera">
        {MOTION_OPTIONS.map((m) => (
          <Seg key={m.id} on={(shot.motion ?? 'none') === m.id} disabled={t.busy} onClick={() => t.onPatch({ motion: m.id === 'none' ? undefined : m.id }, m.id === 'none' ? 'No camera move' : `${m.label} move`)}>
            {m.label}
          </Seg>
        ))}
      </Segs>
      {!t.first && (
        <Segs label="Transition in">
          {TRANSITION_OPTIONS.map((x) => (
            <Seg key={x.id} on={shot.transitionIn === x.id} disabled={t.busy} onClick={() => t.onPatch({ transitionIn: x.id }, `${x.label} transition`)}>
              {x.label}
            </Seg>
          ))}
        </Segs>
      )}
      <Segs label="Frame">
        <Seg on={(shot.fit ?? t.fit) === 'fill'} disabled={t.busy} onClick={() => t.onPatch({ fit: 'fill' }, 'Fill the frame')}>
          Fill
        </Seg>
        <Seg on={(shot.fit ?? t.fit) === 'blur'} disabled={t.busy} onClick={() => t.onPatch({ fit: 'blur' }, 'Blurred background')}>
          Blur background
        </Seg>
      </Segs>
      {!shot.hold && shot.clipAudio !== 'mute' && (
        <label className="flex items-center gap-3 text-[13px] font-semibold">
          <span className="w-24 shrink-0 text-muted">Clip volume</span>
          <input type="range" min={0} max={200} step={5} value={Math.round((shot.volume ?? 1) * 100)} onChange={(e) => t.onVolume(Number(e.target.value) / 100)} className="h-9 flex-1" aria-label="Clip volume" />
          <span className="tabular w-11 text-right">{Math.round((shot.volume ?? 1) * 100)}%</span>
        </label>
      )}
    </div>
  )
}

function ToolButton({ icon, label, hint, onClick, disabled, danger }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint ? `${label} ${hint}` : label}
      className={cn('flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold transition hover:bg-white/14 disabled:opacity-50', danger && 'text-danger')}
    >
      {icon}
      {label}
    </button>
  )
}

function Segs({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 md:flex-row md:items-start md:gap-3">
      <span className="shrink-0 text-[13px] font-semibold text-muted md:w-24 md:pt-2">{label}</span>
      <div className="-mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  )
}

function Seg({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      className={cn('h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition disabled:opacity-60', on ? 'bg-white text-ink' : 'bg-surface-2 text-muted hover:text-fg')}
    >
      {children}
    </button>
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
