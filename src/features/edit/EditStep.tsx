import { useCallback, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { Redo2, Sparkles, Undo2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { currentEdit, useProject } from '@/store/projectStore'
import { PreviewPlayer } from '@/render/PreviewPlayer'
import { stepPath } from '@/features/project/steps'
import { ExportSheet } from '@/features/export/ExportSheet'
import { AiError } from '@/ai'
import { authEnabled, useAuthSheet } from '@/features/auth/auth'
import { tellAi, undo, redo } from './editActions'
import { MusicPanel, ScenesPanel, StylePanel, VoicePanel, type PanelId } from './GlobalPanels'
import { SceneEditor } from './SceneEditor'
import { LookPanel } from './LookPanel'
import { TellAiBar, TellAiSheet } from './TellAi'
import { useEditorData } from './useEditorData'
import { useMediaQuery } from '@/lib/useMediaQuery'
import '@/features/voice/followVoice' // own voice: script and footage follow what was said
import { ExportSupportNotice } from '@/features/export/ExportSupport'
import { Tour } from '@/features/tutorial/Tour'

const PANELS: { id: PanelId; label: string }[] = [
  { id: 'scenes', label: 'Scenes' },
  { id: 'look', label: 'Look' },
  { id: 'voice', label: 'Voice' },
  { id: 'music', label: 'Music' },
  { id: 'style', label: 'Text' },
]

export function EditStep() {
  const { project, clips } = useProject()
  const plan = currentEdit(project)
  const { timeline, mix, staleMix } = useEditorData(project, plan, clips)
  const [params] = useSearchParams()
  const [panel, setPanel] = useState<PanelId>('scenes')
  const [sceneOpen, setSceneOpen] = useState<number | null>(null)
  const [seek, setSeek] = useState<{ t: number; n: number }>()
  const [now, setNow] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [aiSheet, setAiSheet] = useState(false)
  const [exporting, setExporting] = useState(false)
  const onTime = useCallback((t: number) => setNow(t), [])
  const desktop = useMediaQuery('(min-width: 768px)')

  if (!project) return null
  if (!plan || !timeline) return <Navigate to={stepPath(project.id, 'generate')} replace />

  const ask = async (text: string): Promise<boolean> => {
    setThinking(true)
    try {
      await tellAi(text)
      setAiSheet(false)
      toast(`Done: ${text}`, 'success', { label: 'Undo', run: () => void undo() })
      return true
    } catch (e) {
      if (authEnabled && e instanceof AiError && (e.code === 'quota' || e.code === 'auth')) useAuthSheet.getState().show(e.message)
      else toast((e as Error).message, 'error')
      return false
    } finally {
      setThinking(false)
    }
  }

  const activeScene = timeline.scenes.findIndex((s) => now >= s.start && now < s.end)
  const openScene = (i: number) => {
    setSeek({ t: timeline.scenes[i].start + 0.01, n: Date.now() })
    setSceneOpen(i)
  }
  const editing = sceneOpen !== null

  return (
    <main className="relative mx-auto w-full max-w-[1120px] flex-1 px-4 pt-5 pb-32 md:px-10 md:pt-6 md:pb-10">
      <div className="ember-wash -z-10" aria-hidden />
      <ExportSupportNotice className="mb-4" />

      <div className="mb-5 flex items-center gap-2">
        <IconButton onClick={undo} disabled={project.currentEdit <= 0} aria-label="Undo" className="border border-white/14">
          <Undo2 className="size-[18px]" strokeWidth={2.4} />
        </IconButton>
        <IconButton onClick={redo} disabled={project.currentEdit >= project.edits.length - 1} aria-label="Redo" className="border border-white/14">
          <Redo2 className="size-[18px]" strokeWidth={2.4} />
        </IconButton>
        <p className="tabular min-w-0 flex-1 truncate pl-1 text-[13px] font-medium text-muted" title={plan.note} data-testid="version-note">
          Version {plan.version}
          {plan.note ? ` · ${plan.note}` : ''}
        </p>
        {desktop && (
          <Button variant="ember" onClick={() => setExporting(true)} data-tour="export">
            Export video
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-6 md:gap-8">
        {/* Preview: sticky beside the panel on desktop; pinned small on phone while editing a scene */}
        <div
          className={cn(
            'w-full md:sticky md:top-[90px] md:w-[340px] md:shrink-0',
            editing && 'sticky top-[68px] z-10 -mx-4 w-[calc(100%+2rem)] border-b border-border bg-[rgb(9_9_10/.92)] px-4 py-3 backdrop-blur-[14px] md:mx-0 md:w-[340px] md:border-0 md:bg-transparent md:p-0',
          )}
        >
          <div data-tour="preview" className="mx-auto w-fit md:w-auto">
          <PreviewPlayer timeline={timeline} project={project} mix={mix ?? staleMix} seek={seek} onTime={onTime} autoPlay={params.get('play') === '1'} compact={editing && !desktop} />
          </div>
        </div>

        <div className="min-w-0 flex-[1_1_420px]">
          {editing ? (
            <SceneEditor key={`${sceneOpen}-${plan.version}`} project={project} plan={plan} clips={clips} index={sceneOpen} onClose={() => setSceneOpen(null)} onIndex={(i) => setSceneOpen(i)} timeline={timeline} now={now} />
          ) : (
            <>
              <nav className="mb-4 flex rounded-full bg-surface p-1" aria-label="Edit panels">
                {PANELS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={panel === p.id}
                    data-tour={`tab-${p.id}`}
                    onClick={() => setPanel(p.id)}
                    className={cn('h-11 min-w-0 flex-1 rounded-full text-[14px] font-semibold md:text-[15px] transition duration-150 ease-ember', panel === p.id ? 'bg-white text-ink' : 'text-muted hover:text-fg')}
                  >
                    {p.label}
                  </button>
                ))}
              </nav>
              {panel === 'scenes' && <div data-tour="scenes"><ScenesPanel plan={plan} timeline={timeline} project={project} clips={clips} activeScene={activeScene} onOpen={openScene} /></div>}
              {panel === 'look' && <LookPanel project={project} plan={plan} clips={clips} />}
              {panel === 'voice' && <VoicePanel project={project} />}
              {panel === 'music' && <MusicPanel project={project} />}
              {panel === 'style' && <StylePanel project={project} clips={clips} />}
            </>
          )}
          {desktop && <TellAiBar thinking={thinking} onAsk={ask} />}
        </div>
      </div>

      {/* Phone bottom bar */}
      {!desktop && (
      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 bg-gradient-to-b from-transparent to-bg to-32% px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:hidden">
        <Button variant="quiet" className="min-w-0 flex-1 justify-start" onClick={() => setAiSheet(true)} data-tour="tell-ai">
          <Sparkles className="size-[18px] text-ember-300" strokeWidth={2.2} /> Tell the AI
        </Button>
        <Button variant="ember" onClick={() => setExporting(true)} data-tour="export">
          Export
        </Button>
      </div>
      )}

      {!editing && !exporting && !aiSheet && <Tour page="edit" />}
      <TellAiSheet open={aiSheet} onClose={() => setAiSheet(false)} thinking={thinking} onAsk={ask} />
      {exporting && <ExportSheet project={project} timeline={timeline} clips={clips} onClose={() => setExporting(false)} />}
    </main>
  )
}
