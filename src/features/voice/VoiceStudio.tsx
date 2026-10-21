import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Play, RotateCcw, Scissors, Square, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { buildTimeline } from '@/domain/timeline'
import type { Clip, EditPlan, Project, VoiceTake, VoiceTrack } from '@/domain/types'
import { moveTake, splitTake, takeEnd, takeLength, trimTake } from '@/domain/voiceTrack'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import { addTake, deleteTake, transcribeTake, updateTakes } from '@/pipeline/voiceTrack'
import { renderVoiceOnly } from '@/render/mix'
import { PreviewPlayer, type PlayerControl } from '@/render/PreviewPlayer'
import { startRecording, type Recording } from './recorder'

/**
 * "Record my own": a voiceover studio. The made vlog plays with the script
 * lines on screen; the user records over it in one long take or in pieces,
 * then moves, trims, splits or deletes the takes on a voice track.
 */
export function VoiceStudio({ project, clips, plan: edit }: { project: Project; clips: Clip[]; plan: EditPlan }) {
  const control = useRef<PlayerControl | null>(null)
  const recRef = useRef<{ from: number; rec: Recording } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [now, setNow] = useState(0)
  /** timeline time the current take started at; null when not recording */
  const [recFrom, setRecFrom] = useState<number | null>(null)
  const recording = recFrom !== null
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const [mix, setMix] = useState<AudioBuffer | null>(null)

  const track: VoiceTrack = useMemo(() => project.voiceTrack ?? { takes: [] }, [project.voiceTrack])
  const lines = useMemo(() => (project.script?.lines ?? []).filter((l) => l.text.trim()), [project.script])
  const byId = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips])
  const plan = useMemo(() => ({ ...edit, title: { ...edit.title, text: project.title } }), [edit, project.title])
  const script = useMemo(() => (lines.length ? { title: project.title, lines } : undefined), [lines, project.title])
  // Script lines show on the video as a teleprompter; the voice comes from the takes.
  // The video shows the real result: captions are what was said, never the script.
  const timeline = useMemo(() => buildTimeline(plan, byId, script, 'recorded', track), [plan, byId, script, track])
  const duration = timeline.duration

  const voiceKey = JSON.stringify(timeline.voice)
  useEffect(() => {
    let alive = true
    void renderVoiceOnly(timeline.voice, duration).then((b) => alive && setMix(b))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-render the mix only when the voice changes
  }, [voiceKey, duration])

  const stop = useCallback(async () => {
    const r = recRef.current
    if (!r) return
    recRef.current = null
    control.current?.pause()
    setRecFrom(null)
    setSaving(true)
    try {
      const blob = await r.rec.stop()
      const take = await addTake(blob, r.from)
      setSelected(take.id)
    } catch (e) {
      console.warn('Saving the take failed', e)
      toast('Couldn’t save that take. Try recording again.', 'error')
    } finally {
      setSaving(false)
    }
  }, [])

  const record = async (from?: number) => {
    if (recRef.current || saving) return
    const t = control.current?.time() ?? 0
    const start = from ?? (t >= duration - 0.3 ? 0 : t)
    let rec: Recording
    try {
      rec = await startRecording()
    } catch {
      toast('Couldn’t use the microphone. Allow microphone access and try again.', 'error')
      return
    }
    recRef.current = { from: start, rec }
    setRecFrom(start)
    control.current?.play(start)
  }

  // Playback stopping (end of the video, or the player's pause button) ends the take.
  const onPlayingChange = useCallback(
    (playing: boolean) => {
      if (!playing && recRef.current) void stop()
    },
    [stop],
  )

  useEffect(() => {
    if (!recording) return
    let raf = 0
    const tick = () => {
      setLevel(recRef.current?.rec.level() ?? 0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [recording])

  useEffect(() => () => recRef.current?.rec.cancel(), [])

  const importFile = async (file: File | undefined) => {
    if (!file) return
    setSaving(true)
    try {
      const take = await addTake(file, control.current?.time() ?? 0)
      setSelected(take.id)
    } catch {
      toast('Couldn’t read that audio file. Try an MP3, M4A or WAV.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const sel = track.takes.find((t) => t.id === selected)
  const sceneAt = timeline.scenes.findIndex((s) => now >= s.start && now < s.end)
  const lineAt = timeline.scenes[sceneAt]?.lineId
  const recordedSec = track.takes.reduce((a, t) => a + takeLength(t), 0)

  return (
    <div className="space-y-5">

      <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-3">
          {lines.length > 0 && (
            <div className="w-full max-w-[340px] rounded-[var(--radius-card)] bg-surface p-3.5" aria-live="polite">
              <div className="text-[11px] font-bold tracking-[.12em] text-ember-300 uppercase">Your line here · a guide, say it your way</div>
              <div className="mt-1 min-h-[1.5em] text-[17px] leading-snug font-semibold">{lines.find((l) => l.id === lineAt)?.text ?? <span className="text-white/35">No line here, just talk or stay quiet</span>}</div>
            </div>
          )}
          <PreviewPlayer timeline={timeline} project={project} mix={recording ? null : mix} silent={recording} controlRef={control} onTime={setNow} onPlayingChange={onPlayingChange} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-panel)] bg-surface p-4">
            {recording ? (
              <Button variant="ember" onClick={() => void stop()} className="min-w-[150px]">
                <Square className="size-4" fill="currentColor" /> Stop
              </Button>
            ) : (
              <Button onClick={() => void record()} disabled={saving} className="min-w-[150px]" data-tour="record">
                {saving ? <Spinner /> : <span className="size-2.5 rounded-full bg-danger" />} {saving ? 'Saving…' : 'Record'}
              </Button>
            )}
            {recording ? (
              <div className="flex min-w-0 flex-1 items-center gap-3" role="status">
                <span className="size-2.5 animate-pulse rounded-full bg-danger" />
                <span className="tabular text-[14px] font-semibold">Recording from {formatDuration(recFrom ?? 0)}</span>
                <span className="h-2 min-w-[60px] flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <span className="block h-full rounded-full bg-success transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
                </span>
              </div>
            ) : (
              <p className="min-w-0 flex-1 text-[14px] text-muted">
                The video plays while you talk. Record it all in one go, or just the parts you want: move the playhead, then press Record.
              </p>
            )}
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => void importFile(e.target.files?.[0]).then(() => (e.target.value = ''))} />
            {!recording && (
              <Button size="sm" variant="quiet" disabled={saving} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" strokeWidth={2.4} /> Import audio
              </Button>
            )}
          </div>

          <TrackEditor
            duration={duration}
            scenes={timeline.scenes.map((s) => ({ start: s.start, end: s.end, n: s.lineId ? lines.findIndex((l) => l.id === s.lineId) + 1 : 0 }))}
            takes={track.takes}
            selected={selected}
            now={now}
            recordingFrom={recFrom}
            onSeek={(t) => control.current?.seek(t)}
            onSelect={setSelected}
            onCommit={(take) => void updateTakes((takes) => takes.map((t) => (t.id === take.id ? take : t)))}
          />

          <p className="tabular -mt-2 px-1 text-[13px] text-white/45">
            {track.takes.length ? `${track.takes.length} take${track.takes.length === 1 ? '' : 's'} · ${formatDuration(recordedSec)} of voice. Drag a take to move it, drag its edges to trim. Newer takes play over older ones.` : 'Your takes show up on this track.'}
          </p>

          {sel && !recording && (
            <TakeTools
              take={sel}
              now={now}
              busy={saving}
              onPlay={() => control.current?.play(sel.start)}
              onSplit={() => void updateTakes((takes) => takes.flatMap((t) => (t.id === sel.id ? splitTake(t, now) : [t])))}
              onDelete={() => {
                void deleteTake(sel.id)
                setSelected(null)
              }}
              onRerecord={() => {
                const from = sel.start
                void deleteTake(sel.id).then(() => record(from))
                setSelected(null)
              }}
              onVolume={(volume) => void updateTakes((takes) => takes.map((t) => (t.id === sel.id ? { ...t, volume } : t)))}
              onRetryCaptions={() => void transcribeTake(sel.id)}
            />
          )}

          {!lines.length && (
            <p className="rounded-[var(--radius-card)] bg-surface p-4 text-[15px] text-muted">No script, so just talk over the video. Your captions will show what you said.</p>
          )}
          <ol hidden={!lines.length} className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1" aria-label="Your lines">
            {timeline.scenes.map((s, i) => {
              if (!s.lineId) return null
              const line = lines.find((l) => l.id === s.lineId)
              const active = s.lineId === lineAt
              return (
                <li key={`${s.lineId}-${i}`}>
                  <button
                    type="button"
                    onClick={() => control.current?.seek(s.start + 0.01)}
                    className={cn('flex w-full items-start gap-3 rounded-[var(--radius-card)] p-3 text-left transition', active ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_#ff5a1f]' : 'bg-surface hover:bg-[#1a1918]')}
                  >
                    <span className={cn('tabular mt-0.5 w-11 shrink-0 text-[12px] font-bold', active ? 'text-ember-300' : 'text-white/40')}>{formatDuration(s.start)}</span>
                    <span className={cn('min-w-0 flex-1', active ? 'text-[17px] font-semibold' : 'text-[15px] text-white/80')}>{line?.text}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}

const pct = (v: number, d: number) => `${(v / Math.max(d, 0.001)) * 100}%`

/** The scenes and the voice track, with the playhead. Takes can be moved and trimmed by dragging. */
function TrackEditor(props: {
  duration: number
  scenes: { start: number; end: number; n: number }[]
  takes: VoiceTake[]
  selected: string | null
  now: number
  recordingFrom: number | null
  onSeek: (t: number) => void
  onSelect: (id: string | null) => void
  onCommit: (take: VoiceTake) => void
}) {
  const { duration } = props
  const lane = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'in' | 'out'; x0: number; orig: VoiceTake; cur: VoiceTake } | null>(null)

  const secPerPx = () => duration / Math.max(1, lane.current?.getBoundingClientRect().width ?? 1)
  const seekFrom = (e: React.PointerEvent) => {
    const r = lane.current!.getBoundingClientRect()
    props.onSeek(Math.max(0, Math.min(duration, ((e.clientX - r.left) / r.width) * duration)))
  }
  const begin = (e: React.PointerEvent, take: VoiceTake, mode: 'move' | 'in' | 'out') => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    props.onSelect(take.id)
    setDrag({ id: take.id, mode, x0: e.clientX, orig: take, cur: take })
  }
  const move = (e: React.PointerEvent) => {
    if (!drag) return
    const dt = (e.clientX - drag.x0) * secPerPx()
    const o = drag.orig
    const cur =
      drag.mode === 'move' ? moveTake(o, Math.min(o.start + dt, Math.max(0, duration - takeLength(o)))) : trimTake(o, drag.mode, (drag.mode === 'in' ? o.start : takeEnd(o)) + dt)
    setDrag({ ...drag, cur })
  }
  const end = () => {
    if (drag && (drag.cur.start !== drag.orig.start || drag.cur.in !== drag.orig.in || drag.cur.out !== drag.orig.out)) props.onCommit(drag.cur)
    setDrag(null)
  }

  const takes = [...props.takes].sort((a, b) => a.createdAt - b.createdAt).map((t) => (drag?.id === t.id ? drag.cur : t))

  return (
    <div className="rounded-[var(--radius-panel)] bg-surface p-3 select-none" aria-label="Voice track">
      <div ref={lane} className="relative" onPointerDown={(e) => (e.target === e.currentTarget || (e.target as HTMLElement).dataset.lane) && seekFrom(e)}>
        {/* scenes */}
        <div className="relative h-7" data-lane="1">
          {props.scenes.map((s, i) => (
            <div
              key={i}
              data-lane="1"
              className={cn('absolute inset-y-0 flex items-center overflow-hidden rounded-[6px] border-r border-surface px-1.5 text-[11px] font-bold', s.n ? 'bg-white/10 text-white/70' : 'bg-white/[.04] text-white/30')}
              style={{ left: pct(s.start, duration), width: pct(s.end - s.start, duration) }}
            >
              {s.n ? String(s.n).padStart(2, '0') : ''}
            </div>
          ))}
        </div>
        {/* takes */}
        <div className="relative mt-2 h-14 rounded-[10px] bg-black/30" data-lane="1">
          {takes.map((t) => {
            const sel = t.id === props.selected
            const bars = t.peaks.slice(Math.floor(t.in * 40), Math.ceil(t.out * 40))
            const step = Math.max(1, Math.ceil(bars.length / 120))
            const shown = bars.filter((_, i) => i % step === 0)
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                aria-label={`Take at ${formatDuration(t.start)}, ${takeLength(t).toFixed(1)} seconds`}
                aria-pressed={sel}
                onPointerDown={(e) => begin(e, t, 'move')}
                onPointerMove={move}
                onPointerUp={end}
                onKeyDown={(e) => {
                  if (e.key === 'Delete' || e.key === 'Backspace') void deleteTake(t.id)
                }}
                className={cn(
                  'absolute inset-y-1 flex cursor-grab touch-none items-center overflow-hidden rounded-[8px] active:cursor-grabbing',
                  sel ? 'bg-[rgba(255,90,31,.35)] shadow-[inset_0_0_0_1.5px_#ff7a3d]' : 'bg-[rgba(255,122,61,.18)] shadow-[inset_0_0_0_1px_rgba(255,122,61,.35)]',
                )}
                style={{ left: pct(t.start, duration), width: pct(takeLength(t), duration) }}
              >
                <div className="pointer-events-none flex h-full w-full items-center gap-px px-1">
                  {shown.map((p, i) => (
                    <span key={i} className="flex-1 rounded-full bg-ember-200/80" style={{ height: `${Math.max(8, p * 90)}%` }} />
                  ))}
                </div>
                {t.transcript === 'pending' && <Spinner className="pointer-events-none absolute top-1 right-1 size-3" />}
                <span onPointerDown={(e) => begin(e, t, 'in')} onPointerMove={move} onPointerUp={end} className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize bg-white/0 hover:bg-white/25" aria-hidden />
                <span onPointerDown={(e) => begin(e, t, 'out')} onPointerMove={move} onPointerUp={end} className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize bg-white/0 hover:bg-white/25" aria-hidden />
              </div>
            )
          })}
          {props.recordingFrom !== null && (
            <div className="absolute inset-y-1 rounded-[8px] bg-danger/40 shadow-[inset_0_0_0_1.5px_#ff4f4f]" style={{ left: pct(props.recordingFrom, duration), width: pct(Math.max(0, props.now - props.recordingFrom), duration) }} />
          )}
        </div>
        <div className="pointer-events-none absolute -inset-y-1 w-0.5 rounded-full bg-white" style={{ left: pct(props.now, duration) }} aria-hidden />
      </div>
      <div className="tabular mt-1.5 flex justify-between text-[11px] text-white/40">
        <span>0:00</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  )
}

function TakeTools(props: {
  take: VoiceTake
  now: number
  busy: boolean
  onPlay: () => void
  onSplit: () => void
  onDelete: () => void
  onRerecord: () => void
  onVolume: (v: number) => void
  onRetryCaptions: () => void
}) {
  const { take } = props
  const canSplit = props.now > take.start + 0.05 && props.now < takeEnd(take) - 0.05
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-panel)] bg-surface p-3" role="group" aria-label="Selected take">
      <span className="tabular px-1 text-[13px] font-semibold text-muted">
        {formatDuration(take.start)}–{formatDuration(takeEnd(take))}
      </span>
      <Tool onClick={props.onPlay} icon={<Play className="size-4" fill="currentColor" />} label="Play" />
      <Tool onClick={props.onSplit} disabled={!canSplit} icon={<Scissors className="size-4" strokeWidth={2.4} />} label="Split at playhead" />
      <Tool onClick={props.onRerecord} disabled={props.busy} icon={<Mic className="size-4" strokeWidth={2.4} />} label="Re-record" />
      <Tool onClick={props.onDelete} icon={<Trash2 className="size-4" strokeWidth={2.4} />} label="Delete" danger />
      <label className="ml-auto flex items-center gap-2 text-[13px] font-semibold text-muted">
        Volume
        <input type="range" min={0} max={200} step={5} value={Math.round(take.volume * 100)} onChange={(e) => props.onVolume(Number(e.target.value) / 100)} className="h-9 w-28" aria-label="Take volume" />
      </label>
      <span className="w-full px-1 text-[12px] text-white/45">
        {take.transcript === 'pending' && 'Making captions from this take…'}
        {take.transcript === 'done' && (take.words?.length ? 'Captions ready: they show what you said.' : 'No speech found in this take, so it has no captions.')}
        {take.transcript === 'failed' && (
          <>
            Couldn’t make captions for this take.{' '}
            <button type="button" className="font-semibold text-ember-300" onClick={props.onRetryCaptions}>
              <RotateCcw className="mr-1 inline size-3" strokeWidth={2.6} />
              Try again
            </button>
          </>
        )}
      </span>
    </div>
  )
}

function Tool({ icon, label, onClick, disabled, danger }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn('flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold transition hover:bg-white/14 disabled:opacity-40', danger && 'text-danger')}>
      {icon}
      {label}
    </button>
  )
}
