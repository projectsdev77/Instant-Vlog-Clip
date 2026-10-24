import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Lock, LockOpen, Music2, RotateCcw, Scissors, Snowflake, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
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
  duplicateScene,
  editLine,
  freezeFrame,
  holdLastFrame,
  lockScene,
  releaseScene,
  removeLineKeepTime,
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
import { useFilmstrip } from './filmstrip'
import { Fold, Row, Section, Segmented, Slider, type SegOption } from './ui'

const DELIVERIES: Delivery[] = ['natural', 'calm', 'energetic', 'slow']

// Four options each (the design's limit); the rest stay under "More".
const SPEED: SegOption<string>[] = [
  { value: '0.5', label: '0.5×' },
  { value: '1', label: '1×' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: '2×' },
]
const SPEED_MORE: SegOption<string>[] = [
  { value: '3', label: '3×' },
  { value: 'montage', label: 'Montage' },
  { value: 'hero', label: 'Hero' },
  { value: 'bullet', label: 'Bullet' },
]
const CAMERA: SegOption<Motion>[] = [
  { value: 'none', label: 'None' },
  { value: 'zoomIn', label: 'Zoom in' },
  { value: 'zoomOut', label: 'Zoom out' },
  { value: 'panRight', label: 'Pan' },
]
const CAMERA_MORE: SegOption<Motion>[] = [
  { value: 'panLeft', label: 'Pan left' },
  { value: 'punch', label: 'Punch' },
  { value: 'shake', label: 'Shake' },
]
const TRANSITION: SegOption<Transition>[] = [
  { value: 'cut', label: 'Cut' },
  { value: 'crossfade', label: 'Fade' },
  { value: 'whip', label: 'Whip' },
  { value: 'zoom', label: 'Zoom' },
]
const TRANSITION_MORE: SegOption<Transition>[] = [
  { value: 'dip', label: 'Dip' },
  { value: 'slide', label: 'Slide' },
  { value: 'flash', label: 'Flash' },
  { value: 'blur', label: 'Blur' },
]
const SOUND: SegOption<ClipAudioMode>[] = [
  { value: 'mute', label: 'Off' },
  { value: 'duck', label: 'Quiet' },
  { value: 'full', label: 'Full' },
]
const ALL_LABELS = new Map<string, string>([...CAMERA, ...CAMERA_MORE, ...TRANSITION, ...TRANSITION_MORE].map((o) => [o.value, o.label]))

type Props = { project: Project; plan: EditPlan; clips: Clip[]; index: number; onIndex: (i: number) => void; timeline: Timeline; now: number }

/** Everything about one scene: what's said, its clip, motion and sound. */
export function SceneTab({ project, plan, clips, index, onIndex, timeline, now }: Props) {
  const scene = plan.scenes[index]
  const line = project.script?.lines.find((l) => l.id === scene?.lineId)
  const [busy, setBusy] = useState<string | null>(null)
  const [shotIdx, setShotIdx] = useState(0)
  const byId = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips])
  if (!scene) return null
  const si = Math.min(shotIdx, scene.shots.length - 1)
  const shot = scene.shots[si]
  const clip = byId.get(shot.clipId)
  const ts = timeline.scenes[index]
  const locked = !!plan.userScenes?.includes(scene.id)
  const mode = project.voice.mode
  const veryFirst = index === 0 && si === 0
  const playhead = (() => {
    const s = timeline.shots.find((x) => x.shot.id === shot.id)
    return s && now >= s.start && now < s.end ? now - s.start : undefined
  })()

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
  const speedValue = shot.ramp && shot.ramp !== 'none' ? shot.ramp : String(shot.speed ?? 1)

  return (
    <div aria-label={`Scene ${index + 1}`} role="group">
      {/* Header */}
      <div className="flex items-start gap-3 pb-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-bold whitespace-nowrap">
            Scene {index + 1} <span className="text-white/45">of {plan.scenes.length}</span>
          </h2>
          <p className="tabular text-[13px] text-muted">
            {ts ? (ts.end - ts.start).toFixed(1) : '0.0'}s on screen · starts at {formatDuration(ts?.start ?? 0)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
          {!line && (
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12px] font-bold text-fg" title="Nobody talks in this scene: no voice, no caption, just music over the video.">
              <Music2 className="size-3.5" strokeWidth={2.6} /> Music only
            </span>
          )}
          {/* Locked scenes stay as they are when the AI edits; changing a shot by hand locks the scene. */}
          <button
            type="button"
            aria-pressed={locked}
            disabled={!!busy}
            title={locked ? 'The AI won’t change this scene. Tap to unlock.' : 'Keep this scene as it is when you ask the AI for changes.'}
            onClick={() => act('lock', () => (locked ? releaseScene(scene.id) : lockScene(scene.id)))}
            className={cn('flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition', locked ? 'bg-accent-soft text-ember-300 shadow-[inset_0_0_0_1.5px_#ff5a1f]' : 'bg-surface-2 text-muted hover:text-fg')}
          >
            {locked ? <Lock className="size-3.5" strokeWidth={2.6} /> : <LockOpen className="size-3.5" strokeWidth={2.6} />}
            {locked ? 'Locked from AI' : 'Lock from AI'}
          </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <RoundButton label="Previous scene" disabled={index === 0} onClick={() => onIndex(index - 1)}>
            <ChevronLeft className="size-[18px]" strokeWidth={2.4} />
          </RoundButton>
          <RoundButton label="Next scene" disabled={index === plan.scenes.length - 1} onClick={() => onIndex(index + 1)}>
            <ChevronRight className="size-[18px]" strokeWidth={2.4} />
          </RoundButton>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <IconTool
            label="Duplicate scene"
            disabled={!!busy}
            onClick={() =>
              act('dup', async () => {
                await duplicateScene(index)
                toast(`Added a copy as scene ${index + 2}.`, 'info', { label: 'Undo', run: () => void undo() })
              })
            }
          >
            <Copy className="size-[18px]" strokeWidth={2.4} />
          </IconTool>
          <IconTool
            label="Delete scene"
            danger
            disabled={!!busy || plan.scenes.length <= 1}
            onClick={() =>
              act('delete', async () => {
                await deleteScene(index)
                onIndex(Math.max(0, index - 1))
                toast(`Scene ${index + 1} deleted.`, 'info', { label: 'Undo', run: () => void undo() })
              })
            }
          >
            <Trash2 className="size-[18px]" strokeWidth={2.4} />
          </IconTool>
        </div>
      </div>

      <Section title="What’s said" helper={sayHelper(mode, !!line?.muted)} className="border-t">
        <LineField
          key={`${scene.id}-${line?.text ?? ''}`}
          text={line?.text ?? ''}
          busy={busy === 'line'}
          onSave={(t) =>
            act('line', async () => {
              if (line && !t) await removeLineKeepTime(line.id)
              else if (line) await editLine(line.id, t)
              else if (t) onIndex(await addLine(index, t))
            })
          }
        />
        {line && mode === 'ai' && (
          <div className="space-y-3 pt-1">
            {!line.muted && (
              <Row label="Read it">
                <Segmented label="Read it" options={DELIVERIES.map((d) => ({ value: d, label: d === 'energetic' ? 'Energetic' : DELIVERY_LABEL[d] }))} value={line.delivery ?? 'natural'} disabled={!!busy} onChange={(d) => act('read', () => rereadLine(line.id, d))} />
              </Row>
            )}
            <div className="flex flex-wrap gap-2">
              {!line.muted && (
                <ChipButton disabled={!!busy} onClick={() => act('read', () => rereadLine(line.id, line.delivery ?? 'natural'))}>
                  {busy === 'read' ? <Spinner className="size-3.5" /> : <RotateCcw className="size-4" strokeWidth={2.4} />} Read again
                </ChipButton>
              )}
              <ChipButton disabled={!!busy} onClick={() => act('mute', () => setLineMuted(line.id, !line.muted))}>
                {busy === 'mute' ? <Spinner className="size-3.5" /> : line.muted ? <Volume2 className="size-4" strokeWidth={2.4} /> : <VolumeX className="size-4" strokeWidth={2.4} />}
                {line.muted ? 'Turn voice on' : 'Mute voice'}
              </ChipButton>
            </div>
          </div>
        )}
      </Section>

      <Section title="Clip" aside={shot.hold ? `Freeze frame at ${formatDuration(shot.in)}` : clip ? `Using ${formatDuration(shot.in)}–${formatDuration(shot.out)} of ${formatDuration(clip.durationSec)}` : undefined}>
        {scene.shots.length > 1 && (
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Shots in this scene" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {scene.shots.map((s, i) => (
                <button key={s.id} type="button" role="tab" aria-selected={i === si} onClick={() => setShotIdx(i)} className={cn('h-9 shrink-0 rounded-full px-3.5 text-[13px] whitespace-nowrap transition', i === si ? 'bg-white font-bold text-ink' : 'bg-surface-2 font-medium text-white/72 hover:text-fg')}>
                  Shot {i + 1} · {shotLength(s).toFixed(1)}s
                </button>
              ))}
            </div>
            <IconTool
              label={`Remove shot ${si + 1}`}
              disabled={!!busy}
              onClick={() =>
                act('shot', async () => {
                  await deleteShot(index, si)
                  setShotIdx(0)
                  toast('Shot removed.', 'info', { label: 'Undo', run: () => void undo() })
                })
              }
            >
              <X className="size-[18px]" strokeWidth={2.4} />
            </IconTool>
          </div>
        )}
        {clip && !shot.hold && <TrimStrip key={`${shot.id}-${shot.in}-${shot.out}`} clip={clip} shot={shot} disabled={!!busy} onApply={(a, b) => act('trim', () => trimShot(index, si, a, b))} />}
        <div className="flex flex-wrap gap-2">
          <ChipButton disabled={!!busy} onClick={() => act('tool', () => splitShot(index, si, playhead))}>
            <Scissors className="size-4" strokeWidth={2.4} /> {playhead !== undefined ? 'Split at playhead' : 'Split in half'}
          </ChipButton>
          <ChipButton disabled={!!busy} onClick={() => act('tool', () => (playhead !== undefined ? freezeFrame(index, si, playhead) : holdLastFrame(index, si)))}>
            <Snowflake className="size-4" strokeWidth={2.4} /> {playhead !== undefined ? 'Freeze at playhead' : 'Hold last frame'}
          </ChipButton>
        </div>
        <Swap clips={clips} current={shot} busy={busy === 'swap'} onPick={(c, m) => act('swap', () => swapShot(index, si, c.id, m))} />
      </Section>

      <Section title="Motion" helper="More moves are under More. For a whole style, pick a template in Look.">
        {!shot.hold && (
          <Row label="Speed">
            <Segmented
              label="Speed"
              options={SPEED}
              more={SPEED_MORE}
              value={speedValue}
              disabled={!!busy}
              onChange={(v) => act('tool', () => (['montage', 'hero', 'bullet'].includes(v) ? setShotSpeed(index, si, 1, v as Ramp) : setShotSpeed(index, si, Number(v))))}
            />
          </Row>
        )}
        <Row label="Camera">
          <Segmented
            label="Camera"
            options={CAMERA}
            more={CAMERA_MORE}
            value={shot.motion ?? 'none'}
            disabled={!!busy}
            onChange={(m) => act('tool', () => updateShot(index, si, { motion: m === 'none' ? undefined : m }, m === 'none' ? 'No camera move' : `${ALL_LABELS.get(m)} move`))}
          />
        </Row>
        {!veryFirst && (
          <Row label="Transition in">
            <Segmented label="Transition in" options={TRANSITION} more={TRANSITION_MORE} value={shot.transitionIn} disabled={!!busy} onChange={(x) => act('tool', () => updateShot(index, si, { transitionIn: x }, `${ALL_LABELS.get(x)} transition`))} />
          </Row>
        )}
      </Section>

      <Section>
        <Row label={<span className="text-[15px] font-bold text-fg">Clip sound</span>}>
          <Segmented label="Clip sound" options={SOUND} value={shot.clipAudio} disabled={!!busy} onChange={(m) => act('audio', () => setShotAudio(index, si, m))} />
        </Row>
      </Section>

      <Fold title="More for this clip" summary={moreSummary(shot, plan.look?.fit ?? 'fill')}>
        {!shot.hold && shot.clipAudio !== 'mute' && (
          <ClipVolume key={shot.id} value={shot.volume ?? 1} onChange={(v) => void setShotVolume(index, si, v)} />
        )}
        <Row label="Frame">
          <Segmented<Fit | 'look'>
            label="Frame"
            options={[
              { value: 'look', label: 'As in Look' },
              { value: 'fill', label: 'Fill' },
              { value: 'blur', label: 'Blurred edges' },
            ]}
            value={shot.fit ?? 'look'}
            disabled={!!busy}
            onChange={(f) => act('tool', () => updateShot(index, si, { fit: f === 'look' ? undefined : f }, f === 'blur' ? 'Blurred background' : f === 'fill' ? 'Fill the frame' : 'Frame as in Look'))}
          />
        </Row>
      </Fold>
    </div>
  )
}

function sayHelper(mode: Project['voice']['mode'], muted: boolean): string {
  if (mode === 'recorded') return 'Shown as a guide while you record. Captions come from what you say. Leave it empty for a music-only moment.'
  if (mode === 'none') return 'Shown as the caption. Leave it empty for a music-only moment.'
  if (muted) return 'The AI voice skips this line. It still shows as the caption.'
  return 'Read aloud and shown as the caption. Leave it empty for a music-only moment.'
}

function moreSummary(shot: Shot, lookFit: Fit): string {
  const vol = shot.clipAudio === 'mute' ? 'Clip sound off' : `Clip volume ${Math.round((shot.volume ?? 1) * 100)}%`
  const fit = (shot.fit ?? lookFit) === 'blur' ? 'blurred edges' : 'fill'
  return `${vol} · ${fit}${shot.fit ? '' : ' (as in Look)'}`
}

/** The line, saved when you leave the field or press Enter. Empty = music only. */
function LineField({ text, busy, onSave }: { text: string; busy: boolean; onSave: (t: string) => void }) {
  const [value, setValue] = useState(text)
  const save = () => {
    const t = value.trim()
    if (t !== text.trim()) onSave(t)
  }
  return (
    <div className="relative">
      <textarea
        value={value}
        rows={1}
        maxLength={200}
        aria-label="What’s said"
        placeholder="Nothing said here. Music plays over this scene."
        onChange={(e) => setValue(e.target.value.replace(/\n/g, ' '))}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          }
        }}
        className="block min-h-[52px] w-full resize-none rounded-[16px] bg-surface-2 px-4 py-3.5 text-[16px] leading-snug [field-sizing:content] outline-none placeholder:text-white/40 focus:shadow-[inset_0_0_0_1.5px_#ff5a1f]"
      />
      {busy && <Spinner className="absolute top-4 right-4" />}
    </div>
  )
}

function ClipVolume({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [v, setV] = useState(Math.round(value * 100))
  return (
    <Slider
      label="Clip volume"
      value={v}
      min={0}
      max={200}
      step={5}
      format={(x) => `${x}%`}
      onChange={(x) => {
        setV(x)
        onChange(x / 100)
      }}
    />
  )
}

/** One filmstrip with two handles: the kept part is ringed, the rest darkened. Snaps to 0.1 s. */
function TrimStrip({ clip, shot, disabled, onApply }: { clip: Clip; shot: Shot; disabled: boolean; onApply: (a: number, b: number) => void }) {
  const frames = useFilmstrip(clip)
  const ref = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ a: shot.in, b: shot.out })
  const drag = useRef<'a' | 'b' | null>(null)
  const dur = clip.durationSec
  const minLen = 0.5
  const snap = (t: number) => Math.round(t * 10) / 10
  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return snap(Math.max(0, Math.min(dur, ((clientX - r.left) / r.width) * dur)))
  }
  const move = (which: 'a' | 'b', t: number) => setRange((r) => (which === 'a' ? { ...r, a: Math.min(t, r.b - minLen) } : { ...r, b: Math.max(t, r.a + minLen) }))
  const finish = () => {
    drag.current = null
    if (Math.abs(range.a - shot.in) > 0.01 || Math.abs(range.b - shot.out) > 0.01) onApply(range.a, range.b)
  }
  const pct = (t: number) => `${(t / dur) * 100}%`
  const handle = (which: 'a' | 'b') => (
    <button
      type="button"
      role="slider"
      aria-label={which === 'a' ? 'Trim start' : 'Trim end'}
      aria-valuemin={0}
      aria-valuemax={Math.round(dur * 10) / 10}
      aria-valuenow={which === 'a' ? range.a : range.b}
      aria-valuetext={formatDuration(which === 'a' ? range.a : range.b)}
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = which
      }}
      onPointerMove={(e) => drag.current === which && move(which, at(e.clientX))}
      onPointerUp={finish}
      onKeyDown={(e) => {
        const d = e.key === 'ArrowLeft' ? -0.1 : e.key === 'ArrowRight' ? 0.1 : 0
        if (d) {
          e.preventDefault()
          move(which, snap((which === 'a' ? range.a : range.b) + d))
        }
      }}
      onKeyUp={(e) => (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && finish()}
      className="absolute top-1/2 z-10 grid h-[34px] w-[14px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-[5px] bg-accent shadow-[0_2px_8px_rgb(0_0_0/.5)] focus-visible:outline-2 focus-visible:outline-white"
      style={{ left: pct(which === 'a' ? range.a : range.b) }}
    >
      <span className="h-3 w-[2px] rounded-full bg-white" />
    </button>
  )
  return (
    <div className="px-[7px]">
      <div ref={ref} className="relative h-14 select-none">
        <div className="absolute inset-0 flex overflow-hidden rounded-[12px] bg-surface-2">
          {frames.map((f, i) => (
            <img key={i} src={f} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 rounded-l-[12px] bg-[rgb(9_9_10/.72)]" style={{ width: pct(range.a) }} />
        <div className="absolute inset-y-0 right-0 rounded-r-[12px] bg-[rgb(9_9_10/.72)]" style={{ left: pct(range.b) }} />
        <div className="pointer-events-none absolute inset-y-0 rounded-[10px] shadow-[inset_0_0_0_3px_#ff5a1f]" style={{ left: pct(range.a), width: `${((range.b - range.a) / dur) * 100}%` }} />
        {handle('a')}
        {handle('b')}
      </div>
    </div>
  )
}

function Swap({ clips, current, busy, onPick }: { clips: Clip[]; current: Shot; busy: boolean; onPick: (c: Clip, m: Moment) => void }) {
  const currentClip = clips.find((c) => c.id === current.clipId)
  const options = useMemo(
    () =>
      clips
        .filter((c) => c.status !== 'error' && c.durationSec > 0)
        .flatMap((c) => rankedMoments(c).map((m) => ({ c, m })))
        .filter(({ c, m }) => !(c.id === current.clipId && m.start < current.out && m.end > current.in))
        .sort((a, b) => b.m.score - a.m.score)
        .slice(0, 8),
    [clips, current],
  )
  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex items-center gap-2 text-[14px] text-muted">Swap for another good moment {busy && <Spinner className="size-3.5" />}</div>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
        <li className="shrink-0">
          <span className="block h-[92px] w-[58px] overflow-hidden rounded-[12px] shadow-[0_0_0_2px_#ff5a1f]" aria-label="Current shot">
            {currentClip?.thumbnail && <img src={currentClip.thumbnail} alt="" className="size-full object-cover" />}
          </span>
        </li>
        {options.map(({ c, m }) => (
          <li key={`${c.id}-${m.start}`} className="shrink-0">
            <button type="button" disabled={busy} onClick={() => onPick(c, m)} className="block h-[92px] w-[58px] overflow-hidden rounded-[12px] bg-surface-2 transition hover:opacity-80" aria-label={`Use ${formatDuration(m.start)} to ${formatDuration(m.end)} of ${c.fileName}`}>
              {c.thumbnail && <img src={c.thumbnail} alt="" className="size-full object-cover" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoundButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-10 place-items-center rounded-full bg-surface-2 transition hover:bg-[#262321] disabled:text-white/35 disabled:hover:bg-surface-2">
      {children}
    </button>
  )
}

function IconTool({ label, onClick, disabled, danger, pressed, className, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; pressed?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn('grid size-10 place-items-center rounded-full text-white/80 transition hover:bg-white/8 hover:text-fg disabled:text-white/35 disabled:hover:bg-transparent', danger && 'hover:bg-[rgb(255_79_79/.12)] hover:text-danger', className)}
    >
      {children}
    </button>
  )
}

function ChipButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex h-10 items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] font-semibold transition hover:bg-[#262321] disabled:opacity-50">
      {children}
    </button>
  )
}
