import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Sparkles, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { Field, TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import { uid } from '@/domain/ids'
import type { ScriptLine } from '@/domain/types'
import { WORDS_PER_SECOND, words } from '@/domain/timing'
import { formatDuration } from '@/lib/format'
import { useProject } from '@/store/projectStore'
import { analyzeClipsInBackground } from '@/pipeline/analysis'
import { StepFooter, StepHeading, StepPage } from '@/features/project/ProjectLayout'
import { stepIndex, stepPath } from '@/features/project/steps'
import { AiError } from '@/ai'
import { authEnabled, useAuthSheet } from '@/features/auth/auth'
import { generateScript } from './scriptActions'
import { ASPECTS, LENGTHS, VIBES } from './settingsOptions'

export function ScriptStep() {
  const { project, updateProject } = useProject()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<null | 'write' | 'polish'>(null)
  const [confirmRewrite, setConfirmRewrite] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Start watching the clips with AI while the user writes.
  useEffect(() => {
    void analyzeClipsInBackground()
  }, [])

  // Start with one empty line to type into.
  const hasScript = !!project?.script
  useEffect(() => {
    if (!hasScript) void updateProject((p) => ({ script: { title: p.title, lines: [{ id: uid('l_'), text: '', purpose: 'hook', visualIntent: '' }] } }))
  }, [hasScript, updateProject])

  if (!project) return null
  const lines = project.script?.lines ?? []
  const filled = lines.filter((l) => l.text.trim())
  const spokenSec = filled.reduce((a, l) => a + words(l.text).length, 0) / WORDS_PER_SECOND

  const setLines = (next: ScriptLine[]) => updateProject((p) => ({ script: { title: p.script?.title ?? p.title, lines: next } }))
  const updateLine = (id: string, text: string) => setLines(lines.map((l) => (l.id === id ? { ...l, text, visualIntent: l.visualIntent || text } : l)))
  const addLineAfter = (index: number) => {
    const id = uid('l_')
    setFocusId(id)
    const next = [...lines]
    next.splice(index + 1, 0, { id, text: '', purpose: 'story', visualIntent: '' })
    void setLines(next)
  }
  const removeLine = (id: string) => setLines(lines.length > 1 ? lines.filter((l) => l.id !== id) : lines.map((l) => ({ ...l, text: '' })))

  const run = async (mode: 'write' | 'polish') => {
    setConfirmRewrite(false)
    setBusy(mode)
    try {
      await generateScript(mode)
    } catch (e) {
      if (authEnabled && e instanceof AiError && (e.code === 'quota' || e.code === 'auth')) useAuthSheet.getState().show(e.message)
      else toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = lines.findIndex((l) => l.id === e.active.id)
    const to = lines.findIndex((l) => l.id === e.over!.id)
    void setLines(arrayMove(lines, from, to))
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

  return (
    <>
      <StepPage>
        <StepHeading step={2} title="Say what happened" sub="One short line per moment. Each line becomes a scene and is read aloud." />
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-[1_1_520px] space-y-6">
            <Field label="Title" hint="Shown big at the start of your vlog.">
              <TextInput value={project.title} placeholder="My Day in NYC" maxLength={40} className="h-14 text-[17px] font-semibold" onChange={(e) => updateProject({ title: e.target.value })} />
            </Field>

            <section className="space-y-4 rounded-[var(--radius-panel)] bg-surface p-[18px]">
              <Field
                label={
                  <>
                    What’s it about? <span className="font-medium text-faint">Optional</span>
                  </>
                }
              >
                <TextInput value={project.prompt} placeholder="a lazy park day, coffee and a bike ride" maxLength={200} onChange={(e) => updateProject({ prompt: e.target.value })} />
              </Field>
              {busy ? (
                <div className="inline-flex h-12 items-center gap-2.5 rounded-full bg-surface-2 px-5 text-[15px] font-semibold" role="status">
                  <Spinner /> {busy === 'write' ? 'Writing from your clips…' : 'Polishing…'}
                </div>
              ) : filled.length === 0 ? (
                <Button onClick={() => run('write')}>
                  <Sparkles className="size-4" strokeWidth={2.4} /> Write it for me
                </Button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="quiet" onClick={() => setConfirmRewrite(true)}>
                    <Sparkles className="size-4" strokeWidth={2.4} /> Rewrite with AI
                  </Button>
                  <Button variant="quiet" onClick={() => run('polish')}>
                    <Wand2 className="size-4" strokeWidth={2.4} /> Polish my lines
                  </Button>
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[19px] font-bold tracking-[-0.01em]">Your lines</h2>
                <span className="tabular text-[13px] font-medium text-muted">About {formatDuration(spokenSec)} spoken</span>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-2">
                    {lines.map((l, i) => (
                      <LineRow key={l.id} line={l} index={i} autoFocus={l.id === focusId} disabled={!!busy} onChange={(t) => updateLine(l.id, t)} onRemove={() => removeLine(l.id)} onEnter={() => addLineAfter(i)} />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
              <div className="mt-2 pl-[34px]">
                <Button variant="link" size="sm" className="px-0" onClick={() => addLineAfter(lines.length - 1)} disabled={!!busy}>
                  <Plus className="size-4" strokeWidth={2.6} /> Add line
                </Button>
                <p className="text-[13px] font-medium text-faint">Press Enter for a new line. Drag the dots to reorder.</p>
              </div>
            </section>
          </div>

          <aside className="w-full max-w-[380px] flex-[1_1_300px] space-y-6 rounded-[var(--radius-panel)] bg-surface p-[22px] md:sticky md:top-[92px]">
            <ChipGroup label="Format" options={ASPECTS} value={project.settings.aspect} onChange={(aspect) => updateProject((p) => ({ settings: { ...p.settings, aspect } }))} />
            <ChipGroup label="Length" options={LENGTHS} value={project.settings.targetSec} onChange={(targetSec) => updateProject((p) => ({ settings: { ...p.settings, targetSec } }))} />
            <ChipGroup label="Vibe" options={VIBES} value={project.settings.vibe} onChange={(vibe) => updateProject((p) => ({ settings: { ...p.settings, vibe } }))} />
            <p className="text-[13px] font-medium text-faint">Auto picks from your clips. You can change all of this later.</p>
          </aside>
        </div>
      </StepPage>

      <StepFooter
        summary={
          <Button variant="text" size="sm" className="-ml-4" onClick={() => go(true)} disabled={!!busy}>
            No script, just music
          </Button>
        }
      >
        <Button disabled={!filled.length || !!busy} onClick={() => go(false)}>
          Continue
        </Button>
      </StepFooter>

      <Sheet open={confirmRewrite} title="Replace your lines?" onClose={() => setConfirmRewrite(false)}>
        <p className="text-muted">AI will write new lines from your clips. Your current lines will be replaced.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button block onClick={() => run('write')}>
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

function LineRow(props: { line: ScriptLine; index: number; autoFocus: boolean; disabled: boolean; onChange: (t: string) => void; onRemove: () => void; onEnter: () => void }) {
  const { line, index } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-center gap-1.5 ${isDragging ? 'relative z-10 opacity-90' : ''}`}>
      <button type="button" className="grid h-11 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-faint hover:text-fg" aria-label={`Reorder line ${index + 1}`} {...attributes} {...listeners}>
        <GripVertical className="size-5" />
      </button>
      <TextInput
        value={line.text}
        placeholder={index === 0 ? 'e.g. So here’s a sunny Saturday in the park.' : 'Next moment…'}
        disabled={props.disabled}
        autoFocus={props.autoFocus}
        aria-label={`Line ${index + 1}`}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            props.onEnter()
          }
        }}
      />
      <button type="button" onClick={props.onRemove} className="grid size-11 shrink-0 place-items-center rounded-full text-faint hover:bg-white/8 hover:text-fg" aria-label={`Remove line ${index + 1}`}>
        <X className="size-5" strokeWidth={2.4} />
      </button>
    </li>
  )
}
