import { useCallback, useState } from 'react'
import { Navigate } from 'react-router'
import { Download, Film, Mic, Music2, Palette, Redo2, Send, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import { currentEdit, useProject } from '@/store/projectStore'
import { PreviewPlayer } from '@/render/PreviewPlayer'
import { StepFooter } from '@/features/project/ProjectLayout'
import { stepPath } from '@/features/project/steps'
import { ExportSheet } from '@/features/export/ExportSheet'
import { redo, tellAi, undo } from './editActions'
import { MusicPanel, StylePanel, VoicePanel, type PanelId } from './GlobalPanels'
import { SceneSheet } from './SceneSheet'
import { useEditorData } from './useEditorData'

const PANELS: { id: PanelId; label: string; icon: typeof Film }[] = [
  { id: 'scenes', label: 'Scenes', icon: Film },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'music', label: 'Music', icon: Music2 },
  { id: 'style', label: 'Style', icon: Palette },
]

const SUGGESTIONS = ['Make it punchier', 'Slow it down', 'Start with the best shot']

export function EditStep() {
  const { project, clips } = useProject()
  const plan = currentEdit(project)
  const { timeline, mix, staleMix } = useEditorData(project, plan, clips)
  const [panel, setPanel] = useState<PanelId>('scenes')
  const [sceneOpen, setSceneOpen] = useState<number | null>(null)
  const [seek, setSeek] = useState<{ t: number; n: number }>()
  const [now, setNow] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [thinking, setThinking] = useState(false)
  const [exporting, setExporting] = useState(false)
  const onTime = useCallback((t: number) => setNow(t), [])

  if (!project) return null
  if (!plan || !timeline) return <Navigate to={stepPath(project.id, 'generate')} replace />

  const ask = async (text: string) => {
    if (!text.trim()) return
    setThinking(true)
    try {
      await tellAi(text.trim())
      setFeedback('')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setThinking(false)
    }
  }

  const activeScene = timeline.scenes.findIndex((s) => now >= s.start && now < s.end)
  const clipById = new Map(clips.map((c) => [c.id, c]))

  return (
    <>
      <main className="flex-1 space-y-4 px-4 py-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={project.currentEdit <= 0} onClick={undo} aria-label="Undo">
            <Undo2 className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" disabled={project.currentEdit >= project.edits.length - 1} onClick={redo} aria-label="Redo">
            <Redo2 className="size-4" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-xs text-muted" title={plan.note}>
            {plan.note ?? `Version ${plan.version}`}
          </p>
          <Button size="sm" onClick={() => setExporting(true)}>
            <Download className="size-4" /> Export
          </Button>
        </div>

        <PreviewPlayer timeline={timeline} project={project} mix={mix ?? staleMix} seek={seek} onTime={onTime} />

        <nav className="flex gap-1 rounded-full bg-surface p-1" aria-label="Edit panels">
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={panel === p.id}
              onClick={() => setPanel(p.id)}
              className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium', panel === p.id ? 'bg-bg shadow-sm' : 'text-muted')}
            >
              <p.icon className="size-4" /> {p.label}
            </button>
          ))}
        </nav>

        {panel === 'scenes' && (
          <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" aria-label="Scenes">
            {plan.scenes.map((scene, i) => {
              const ts = timeline.scenes[i]
              const clip = clipById.get(scene.shots[0]?.clipId)
              const line = project.script?.lines.find((l) => l.id === scene.lineId)
              return (
                <li key={scene.id} className="w-28 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSeek({ t: ts.start + 0.01, n: Date.now() })
                      setSceneOpen(i)
                    }}
                    className={cn('block w-full rounded-xl border-2 p-1 text-left transition', activeScene === i ? 'border-accent' : 'border-transparent')}
                  >
                    <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-surface-2">
                      {clip?.thumbnail && <img src={clip.thumbnail} alt="" className="size-full object-cover" />}
                      <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">{i + 1}</span>
                      <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1.5 text-[11px] text-white">{formatDuration(ts.end - ts.start)}</span>
                      {scene.shots.length > 1 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[11px] text-white">{scene.shots.length} shots</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-snug">{line?.text ?? clip?.analysis?.description ?? ''}</p>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
        {panel === 'voice' && <VoicePanel project={project} />}
        {panel === 'music' && <MusicPanel project={project} />}
        {panel === 'style' && <StylePanel project={project} />}
      </main>

      <StepFooter>
        <form
          className="flex w-full flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void ask(feedback)
          }}
        >
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={thinking} onClick={() => ask(s)} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted hover:bg-surface">
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder='Tell the AI: "open with the sunset"'
              aria-label="Tell the AI what to change"
              disabled={thinking}
              className="h-11 min-w-0 flex-1 rounded-full border border-border bg-bg px-4 text-[15px] focus:border-accent focus:outline-none"
            />
            <Button type="submit" className="rounded-full" disabled={thinking || !feedback.trim()} aria-label="Send">
              {thinking ? <Spinner /> : <Send className="size-4" />}
            </Button>
          </div>
        </form>
      </StepFooter>

      {sceneOpen !== null && <SceneSheet key={`${sceneOpen}-${plan.version}`} project={project} plan={plan} clips={clips} index={sceneOpen} onClose={() => setSceneOpen(null)} />}
      {exporting && <ExportSheet project={project} timeline={timeline} onClose={() => setExporting(false)} />}
    </>
  )
}
