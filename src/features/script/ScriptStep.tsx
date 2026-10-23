import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Music2, Plus, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { uid } from '@/domain/ids'
import type { Clip, ScriptLine } from '@/domain/types'
import { WORDS_PER_SECOND, words } from '@/domain/timing'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useProject } from '@/store/projectStore'
import { analyzeClipsInBackground } from '@/pipeline/analysis'
import { StepFooter, StepPage } from '@/features/project/ProjectLayout'
import { stepIndex, stepPath, stepsFor } from '@/features/project/steps'
import { AiError } from '@/ai'
import { authEnabled, promptForAccess } from '@/features/auth/auth'
import { generateScript, ScriptCancelled, type ScriptStage } from './scriptActions'
import { ASPECTS, TEMPLATE_OPTIONS, templateHint } from './settingsOptions'
import { resolveTemplate } from '@/domain/templates'
import { Tour } from '@/features/tutorial/Tour'
import { ScenePreview } from './ScenePreview'

/** Spoken time for a line, rounded the way the screen shows it ("~3s"). */
const lineSec = (text: string) => {
  const w = words(text).length
  return w ? Math.max(1, Math.round(w / WORDS_PER_SECOND)) : 0
}

export function ScriptStep() {
  const { project, clips, updateProject } = useProject()
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 768px)')
  const [busy, setBusy] = useState<null | 'write' | 'polish'>(null)
  const [stage, setStage] = useState<ScriptStage | null>(null)
  const runId = useRef(0)
  const [started, setStarted] = useState(0)
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!busy) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [busy])
  const waited = busy && now > started ? Math.floor((now - started) / 1000) : 0
  const [confirmRewrite, setConfirmRewrite] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  /** last AI result or error, kept under the AI box until the next attempt */
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  /** lines Polish just changed, highlighted for a few seconds */
  const [edited, setEdited] = useState<Set<string>>(new Set())
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Start watching the clips with AI while the user writes.
  useEffect(() => {
    void analyzeClipsInBackground()
  }, [])

  // Always at least one row to type into.
  const hasScript = !!project?.script?.lines.length
  useEffect(() => {
    if (!hasScript) void updateProject((p) => ({ script: { title: p.title, lines: [{ id: uid('l_'), text: '', purpose: 'hook', visualIntent: '' }] } }))
  }, [hasScript, updateProject])

  if (!project) return null
  const lines = project.script?.lines ?? []
  const filled = lines.filter((l) => l.text.trim())
  const totalSec = filled.reduce((a, l) => a + words(l.text).length, 0) / WORDS_PER_SECOND
  const usable = clips.filter((c) => c.status !== 'error')
  const clipFor = (i: number): Clip | undefined => (usable.length ? usable[i % usable.length] : undefined)
  // The scene being written: the line focused last, else the first filled one, else line 1.
  const focused = lines.findIndex((l) => l.id === activeId)
  const activeIndex = Math.max(0, focused >= 0 ? focused : lines.findIndex((l) => l.text.trim()))
  const active = lines[activeIndex]
  const firstFilled = lines.findIndex((l) => l.text.trim())

  const setLines = (next: ScriptLine[]) => updateProject((p) => ({ script: { title: p.script?.title ?? p.title, lines: next } }))
  const updateLine = (id: string, text: string) => setLines(lines.map((l) => (l.id === id ? { ...l, text, visualIntent: l.visualIntent || text } : l)))
  const addLineAfter = (index: number) => {
    const id = uid('l_')
    setFocusId(id)
    const next = [...lines]
    next.splice(index + 1, 0, { id, text: '', purpose: 'story', visualIntent: '' })
    void setLines(next)
  }
  const removeLine = (id: string) => setLines(lines.length > 1 ? lines.filter((l) => l.id !== id) : [{ id: uid('l_'), text: '', purpose: 'hook', visualIntent: '' }])
  const moveLine = (from: number, to: number) => {
    if (to < 0 || to >= lines.length) return
    setFocusId(lines[from].id)
    void setLines(arrayMove(lines, from, to))
  }

  const run = async (mode: 'write' | 'polish') => {
    const id = ++runId.current
    setConfirmRewrite(false)
    setBusy(mode)
    setStage(null)
    setNote(null)
    setStarted(Date.now())
    try {
      const res = await generateScript(mode, setStage, () => runId.current !== id)
      const n = res?.lines ?? 0
      if (mode === 'write') {
        const msg = `Wrote ${n} line${n === 1 ? '' : 's'} from your clips.`
        toast(msg, 'success')
        setNote({ ok: true, text: msg })
      } else {
        const k = res?.changed.length ?? 0
        setEdited(new Set(res?.changed ?? []))
        window.setTimeout(() => setEdited(new Set()), 5000)
        const msg = k ? `Polished ${k} of ${n} line${n === 1 ? '' : 's'}. Same story, tighter wording.` : 'Your lines already read well. Nothing to change.'
        toast(msg, k ? 'success' : 'info')
        setNote({ ok: true, text: msg })
      }
    } catch (e) {
      if (e instanceof ScriptCancelled) return
      if (authEnabled && e instanceof AiError && (e.code === 'quota' || e.code === 'auth')) void promptForAccess(e.code, e.message)
      else if (e instanceof AiError && e.code === 'quota') toast(e.message, 'error')
      else {
        console.warn(`Script ${mode} failed`, e)
        // Say why when the AI told us (e.g. its usage limit), so it's clear what to do.
        const why = e instanceof Error && e.message ? ` (${e.message.replace(/\.$/, '')})` : ''
        const msg = `Couldn’t ${mode === 'polish' ? 'polish' : 'write'} right now${why}. Your lines are unchanged. Try again.`
        toast(msg, 'error')
        setNote({ ok: false, text: msg })
      }
    } finally {
      if (runId.current === id) {
        setBusy(null)
        setStage(null)
      }
    }
  }
  // Cancel: the answer, when it comes, is ignored and nothing changes.
  const cancelRun = () => {
    runId.current++
    setBusy(null)
    setStage(null)
    setNote({ ok: true, text: 'Cancelled. Your lines are unchanged.' })
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    void setLines(arrayMove(lines, lines.findIndex((l) => l.id === e.active.id), lines.findIndex((l) => l.id === e.over!.id)))
  }

  const go = async (skipScript: boolean) => {
    if (skipScript) {
      await updateProject((p) => ({ script: { title: p.title, lines: [] }, voice: { ...p.voice, mode: 'none' }, step: 'generate' }))
      navigate(stepPath(project.id, 'generate'))
      return
    }
    await updateProject((p) => ({
      script: { title: p.title, lines: lines.filter((l) => l.text.trim()) },
      step: stepIndex(p.step) < stepIndex('voice') ? 'voice' : p.step,
      voice: p.voice.mode === 'none' ? { ...p.voice, mode: 'ai' } : p.voice,
    }))
    navigate(stepPath(project.id, 'voice'))
  }

  const busyLabel = stage?.stage === 'clips' && stage.total ? `Looking at your clips (${stage.done} of ${stage.total})…` : busy === 'write' ? 'Writing from your clips…' : 'Polishing…'
  const summary = filled.length ? `${filled.length} scene${filled.length === 1 ? '' : 's'} · about ${formatDuration(totalSec)}` : 'Add a line to continue'

  return (
    <>
      <StepPage className="pt-6 md:pt-10">
        <div className="flex flex-wrap items-start gap-7 md:gap-12">
          {/* Main column */}
          <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-8">
            <header className="flex flex-col gap-2.5">
              <span className="text-[13px] font-semibold tracking-[.14em] text-ember-300 uppercase">Step 2 of {stepsFor(project.voice.mode).length} · Script</span>
              <textarea
                rows={1}
                value={project.title}
                maxLength={60}
                placeholder="Name your vlog"
                aria-label="Vlog title"
                onChange={(e) => updateProject({ title: e.target.value.replace(/\n/g, ' ') })}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                className="w-full resize-none overflow-hidden bg-transparent text-[32px] leading-[1.1] font-extrabold tracking-[-0.04em] [field-sizing:content] caret-ember-300 outline-none placeholder:text-white/30 focus:shadow-[0_2px_0_0_#ff5a1f] md:text-[clamp(34px,4.2vw,48px)]"
              />
              <p className="max-w-[520px] text-[15px] leading-normal text-white/62">The title opens your vlog. Below, write one short line per moment. Each line becomes a scene and is read aloud.</p>
            </header>

            <div className="flex flex-col gap-2.5">
              <div className="flex min-h-[60px] items-center gap-2.5 rounded-full bg-surface py-1.5 pr-1.5 pl-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]">
                <Sparkles className="size-[17px] shrink-0 text-ember-300" strokeWidth={2.2} aria-hidden />
                <input
                  value={project.prompt}
                  maxLength={200}
                  placeholder="What’s it about? A lazy park day, coffee, a bike ride…"
                  aria-label="What’s it about?"
                  onChange={(e) => updateProject({ prompt: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && !busy && (filled.length ? setConfirmRewrite(true) : void run('write'))}
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/40"
                />
                <div aria-live="polite" className="shrink-0">
                  {busy ? (
                    <span className="flex h-12 items-center gap-2.5 rounded-full bg-surface-2 px-4 text-[14px] font-semibold" role="status">
                      <Spinner className="size-4" /> <span className="max-w-[46vw] truncate md:max-w-none">{busyLabel}</span>
                    </span>
                  ) : filled.length === 0 ? (
                    <button type="button" onClick={() => run('write')} data-tour="write-ai" className="h-12 rounded-full bg-white px-5 text-[15px] font-bold whitespace-nowrap text-ink transition hover:bg-white/90">
                      Write it for me
                    </button>
                  ) : (
                    <button type="button" onClick={() => setConfirmRewrite(true)} className="h-12 rounded-full bg-surface-2 px-5 text-[15px] font-semibold whitespace-nowrap transition hover:bg-white/14">
                      Rewrite
                    </button>
                  )}
                </div>
              </div>
              {busy ? (
                <p className="flex flex-wrap items-center gap-x-3 pl-5 text-[13px] text-white/55" role="status">
                  <span className="tabular">{formatDuration(waited)}</span>
                  {waited >= 30 && <span>The AI is slow right now. Keep waiting, or cancel and write the lines yourself.</span>}
                  <button type="button" onClick={cancelRun} className="-my-1 rounded-full px-2 py-1 font-semibold text-white/80 underline-offset-2 hover:text-white hover:underline">
                    Cancel
                  </button>
                </p>
              ) : (
                <p className="pl-5 text-[13px] text-white/45">AI writes from your clips. Optional, and you can edit every line.</p>
              )}
              {note && (
                <p role={note.ok ? 'status' : 'alert'} className={cn('pl-5 text-[13px] font-semibold', note.ok ? 'text-ember-200' : 'text-[#ff8a8a]')}>
                  {note.text}
                </p>
              )}
            </div>

            <section aria-labelledby="scenes-h">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                <h2 id="scenes-h" className="text-[22px] font-bold tracking-[-0.02em]">
                  Scenes
                </h2>
                <div className="flex items-center gap-2">
                  {filled.length > 0 && !busy && (
                    <button type="button" onClick={() => run('polish')} className="h-9 rounded-full px-3 text-[14px] font-bold text-ember-300 transition hover:bg-[rgba(255,90,31,.08)]">
                      Polish wording
                    </button>
                  )}
                  <span className="tabular text-[13px] text-white/55">About {formatDuration(totalSec)} spoken</span>
                </div>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <ol className="flex flex-col gap-1.5">
                    {lines.map((l, i) => (
                      <SceneRow
                        key={l.id}
                        line={l}
                        index={i}
                        clip={clipFor(i)}
                        active={i === activeIndex}
                        edited={edited.has(l.id)}
                        autoFocus={l.id === focusId}
                        disabled={!!busy}
                        onFocus={() => setActiveId(l.id)}
                        onChange={(t) => updateLine(l.id, t)}
                        onRemove={() => removeLine(l.id)}
                        onEnter={() => addLineAfter(i)}
                        onMove={(d) => moveLine(i, i + d)}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-[44px] sm:pl-[62px]">
                <button type="button" onClick={() => addLineAfter(lines.length - 1)} disabled={!!busy} className="flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-white/20 px-4 text-[14px] font-semibold transition hover:border-ember-300 hover:text-ember-300 disabled:opacity-50">
                  <Plus className="size-4" strokeWidth={2.6} /> Add scene
                </button>
                <span className="text-[13px] text-white/45">Enter adds a line · drag the dots to reorder</span>
              </div>
            </section>
          </div>

          {/* Side column */}
          <aside className="flex w-full min-w-0 flex-[1_1_320px] flex-col gap-4 md:sticky md:top-24">
            {desktop && (
              <ScenePreview
                aspect={project.settings.aspect}
                clip={clipFor(activeIndex)}
                title={project.title}
                text={active?.text.trim() ?? ''}
                index={activeIndex}
                total={lines.length}
                showTitle={activeIndex === firstFilled}
              />
            )}
            <div className="flex flex-col gap-5 rounded-[24px] bg-surface p-[22px]">
              <ChipGroup label="Format" options={ASPECTS} value={project.settings.aspect} onChange={(aspect) => updateProject((p) => ({ settings: { ...p.settings, aspect } }))} />
              <div className="h-px bg-white/8" />
              <div data-tour="template" className="flex flex-col gap-2.5">
                <ChipGroup
                  label="Template"
                  options={TEMPLATE_OPTIONS}
                  value={project.settings.template ?? 'auto'}
                  onChange={(template) => updateProject((p) => ({ settings: { ...p.settings, template, vibe: template === 'auto' ? 'auto' : resolveTemplate(template, p.settings.vibe).vibe } }))}
                />
                <p className="text-[13px] text-white/55">{templateHint(project.settings.template ?? 'auto')}</p>
              </div>
            </div>
          </aside>
        </div>
      </StepPage>

      <StepFooter
        actionsGrow
        summary={
          <Button variant="outline" size="sm" onClick={() => go(true)} disabled={!!busy} title="Make a vlog of just your clips and music, no words">
            <Music2 className="size-4" strokeWidth={2.4} /> <span className="hidden sm:inline">No script, music only</span>
            <span className="sm:hidden">Music only</span>
          </Button>
        }
      >
        <span className="tabular hidden min-w-0 truncate text-[13px] text-white/55 sm:inline">{summary}</span>
        <Button className="h-[52px] shrink-0 px-[26px] text-[16px]" disabled={!filled.length || !!busy} onClick={() => go(false)}>
          Continue
        </Button>
      </StepFooter>
      <Tour page="script" />

      <Sheet open={confirmRewrite} title="Replace your lines?" onClose={() => setConfirmRewrite(false)}>
        <p className="text-muted">
          AI will write new lines from your clips. Your {filled.length} current line{filled.length === 1 ? '' : 's'} will be replaced.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button block className="h-[52px]" onClick={() => run('write')}>
            Replace lines
          </Button>
          <Button block variant="outline" onClick={() => setConfirmRewrite(false)}>
            Keep mine
          </Button>
        </div>
      </Sheet>
    </>
  )
}

function SceneRow(props: {
  line: ScriptLine
  index: number
  clip?: Clip
  active: boolean
  edited: boolean
  autoFocus: boolean
  disabled: boolean
  onFocus: () => void
  onChange: (t: string) => void
  onRemove: () => void
  onEnter: () => void
  onMove: (delta: -1 | 1) => void
}) {
  const { line, index, active } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id })
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (props.autoFocus) ref.current?.focus()
  }, [props.autoFocus])
  const sec = lineSec(line.text)
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start gap-1.5 rounded-[20px] p-1 sm:gap-2.5 sm:p-1.5', isDragging && 'relative z-10 bg-[rgba(255,90,31,.08)]')}
    >
      <button type="button" className="mt-1 grid h-11 w-[22px] shrink-0 cursor-grab touch-none place-items-center text-white/30 hover:text-white/60" aria-label="Drag to reorder" {...attributes} {...listeners}>
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
          {[2, 8, 14].flatMap((y) => [2, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
        </svg>
      </button>
      <span className={cn('tabular mt-[17px] w-6 shrink-0 text-[13px] font-bold', active ? 'text-ember-300' : 'text-white/35')}>{String(index + 1).padStart(2, '0')}</span>
      <span className={cn('relative h-[52px] w-9 shrink-0 overflow-hidden rounded-[10px] bg-surface-2', active ? 'shadow-[0_0_0_2px_#ff5a1f]' : 'shadow-[0_0_0_1px_rgba(255,255,255,.14)]')}>
        {props.clip?.thumbnail && <img src={props.clip.thumbnail} alt="" className="size-full object-cover" />}
      </span>
      <div className="relative min-w-0 flex-1">
        <textarea
          ref={ref}
          rows={1}
          value={line.text}
          placeholder={index === 0 ? 'e.g. So here’s a sunny Saturday in the park.' : 'Next moment…'}
          disabled={props.disabled}
          aria-label={`Scene ${index + 1}`}
          onFocus={props.onFocus}
          onChange={(e) => props.onChange(e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              props.onEnter()
            } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault()
              props.onMove(e.key === 'ArrowUp' ? -1 : 1)
            }
          }}
          className={cn(
            'block min-h-[52px] w-full resize-none overflow-hidden rounded-[16px] py-[15px] pr-11 pl-3.5 text-[15px] leading-[22px] [field-sizing:content] outline-none transition placeholder:text-white/35 focus:shadow-[inset_0_0_0_1.5px_#ff5a1f,0_0_0_4px_rgba(255,90,31,.18)] disabled:opacity-60 sm:pr-[52px] sm:pl-4',
            props.edited ? 'bg-[rgba(255,90,31,.10)] shadow-[inset_0_0_0_1.5px_rgba(255,122,61,.7)]' : 'bg-surface-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]',
          )}
        />
        {props.edited ? (
          <span className="pointer-events-none absolute top-[17px] right-3 text-[12px] font-bold text-ember-300 sm:right-3.5">Polished</span>
        ) : (
          sec > 0 && <span className="tabular pointer-events-none absolute top-[17px] right-3 text-[12px] font-semibold text-white/40 sm:right-3.5">~{sec}s</span>
        )}
      </div>
      <button type="button" onClick={props.onRemove} className="grid size-11 shrink-0 place-items-center rounded-full text-white/45 transition hover:bg-white/6 hover:text-white" aria-label="Remove line">
        <X className="size-5" strokeWidth={2.4} />
      </button>
    </li>
  )
}
