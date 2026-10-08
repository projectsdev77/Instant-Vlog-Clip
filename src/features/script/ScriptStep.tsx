import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Sparkles, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Chip'
import { Spinner } from '@/components/ui/Spinner'
import { AutoTextarea, Field, TextInput } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import { uid } from '@/domain/ids'
import type { ScriptLine } from '@/domain/types'
import { estimateSpeechSec } from '@/domain/timing'
import { formatDuration } from '@/lib/format'
import { useProject } from '@/store/projectStore'
import { analyzeClipsInBackground } from '@/pipeline/analysis'
import { StepFooter } from '@/features/project/ProjectLayout'
import { stepIndex, stepPath } from '@/features/project/steps'
import { generateScript } from './scriptActions'
import { ASPECTS, LENGTHS, VIBES } from './settingsOptions'
import { AiError } from '@/ai'
import { authEnabled, useAuthSheet } from '@/features/auth/auth'

const PLACEHOLDERS = ['I woke up early and grabbed coffee.', 'Then I biked through the park.', 'Met Sam for lunch.', 'Ended the day watching the sunset.']

export function ScriptStep() {
  const { project, updateProject } = useProject()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<null | 'write' | 'polish'>(null)
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
  const estSec = filled.reduce((a, l) => a + estimateSpeechSec(l.text) + 0.35, 0)

  const setLines = (next: ScriptLine[]) => updateProject((p) => ({ script: { title: p.script?.title ?? p.title, lines: next } }))
  const updateLine = (id: string, text: string) => setLines(lines.map((l) => (l.id === id ? { ...l, text, visualIntent: l.visualIntent || text } : l)))
  const addLine = () => {
    const id = uid('l_')
    setFocusId(id)
    void setLines([...lines, { id, text: '', purpose: 'story', visualIntent: '' }])
  }
  const removeLine = (id: string) => setLines(lines.filter((l) => l.id !== id))

  const run = async (mode: 'write' | 'polish') => {
    if (mode === 'write' && filled.length && !confirm('Replace your lines with a new AI script?')) return
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
    const cleaned = lines.filter((l) => l.text.trim())
    if (skipScript) {
      await updateProject({ script: undefined, voice: { ...project.voice, mode: 'none' }, step: 'generate' })
      navigate(stepPath(project.id, 'generate'))
      return
    }
    await updateProject((p) => ({
      script: { title: p.title, lines: cleaned },
      step: stepIndex(p.step) < stepIndex('voice') ? 'voice' : p.step,
      voice: p.voice.mode === 'none' ? { ...p.voice, mode: 'ai' } : p.voice,
    }))
    navigate(stepPath(project.id, 'voice'))
  }

  return (
    <>
      <main className="flex-1 space-y-6 px-4 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add your script</h1>
          <p className="mt-1 text-sm text-muted">A few lines about your day, one per moment. Write your own or let AI write it from your clips.</p>
        </div>

        <Field label="Title" hint="Shown big at the start of your vlog.">
          <TextInput value={project.title} placeholder="My Day in NYC" maxLength={40} onChange={(e) => updateProject({ title: e.target.value })} />
        </Field>

        <Field label="What's it about? (optional)" hint="Helps the AI write in your words.">
          <TextInput value={project.prompt} placeholder="A rainy Sunday baking with my sister" maxLength={200} onChange={(e) => updateProject({ prompt: e.target.value })} />
        </Field>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Script</span>
            {filled.length > 0 && <span className="text-xs text-muted">about {formatDuration(estSec)} spoken</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => run('write')}>
              {busy === 'write' ? <Spinner /> : <Sparkles className="size-4" />} {filled.length ? 'Rewrite with AI' : 'Write it for me'}
            </Button>
            <Button variant="secondary" size="sm" disabled={!!busy || !filled.length} onClick={() => run('polish')}>
              {busy === 'polish' ? <Spinner /> : <Wand2 className="size-4" />} Polish my lines
            </Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2 pt-1">
                {lines.map((l, i) => (
                  <LineRow key={l.id} line={l} index={i} autoFocus={l.id === focusId} placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]} disabled={!!busy} onChange={(t) => updateLine(l.id, t)} onRemove={() => removeLine(l.id)} onEnter={addLine} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          <Button variant="ghost" size="sm" onClick={addLine} disabled={!!busy}>
            <Plus className="size-4" /> Add line
          </Button>
        </section>

        <section className="space-y-4">
          <ChipGroup label="Format" options={ASPECTS} value={project.settings.aspect} onChange={(aspect) => updateProject((p) => ({ settings: { ...p.settings, aspect } }))} />
          <ChipGroup label="Length" options={LENGTHS} value={project.settings.targetSec} onChange={(targetSec) => updateProject((p) => ({ settings: { ...p.settings, targetSec } }))} />
          <ChipGroup label="Vibe" options={VIBES} value={project.settings.vibe} onChange={(vibe) => updateProject((p) => ({ settings: { ...p.settings, vibe } }))} />
        </section>
      </main>
      <StepFooter>
        <Button variant="secondary" size="lg" onClick={() => go(true)} disabled={!!busy}>
          No script
        </Button>
        <Button block size="lg" disabled={!filled.length || !!busy} onClick={() => go(false)}>
          Continue
        </Button>
      </StepFooter>
    </>
  )
}

function LineRow(props: { line: ScriptLine; index: number; autoFocus: boolean; placeholder: string; disabled: boolean; onChange: (t: string) => void; onRemove: () => void; onEnter: () => void }) {
  const { line, index } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-start gap-1.5 ${isDragging ? 'z-10 opacity-80' : ''}`}>
      <button type="button" className="mt-2 cursor-grab touch-none rounded p-1 text-muted hover:bg-surface" aria-label={`Reorder line ${index + 1}`} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <AutoTextarea
        value={line.text}
        placeholder={props.placeholder}
        disabled={props.disabled}
        autoFocus={props.autoFocus}
        aria-label={`Line ${index + 1}`}
        onChange={(e) => props.onChange(e.target.value.replace(/\n/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            props.onEnter()
          }
        }}
      />
      <button type="button" onClick={props.onRemove} className="mt-2 rounded p-1 text-muted hover:bg-surface" aria-label={`Remove line ${index + 1}`}>
        <X className="size-4" />
      </button>
    </li>
  )
}
