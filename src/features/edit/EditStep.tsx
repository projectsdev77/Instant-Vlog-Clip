import { useCallback, useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { Redo2, Sparkles, Undo2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { sumShots } from '@/domain/shots'
import { currentEdit, useProject } from '@/store/projectStore'
import { PreviewPlayer } from '@/render/PreviewPlayer'
import { stepPath, stepsFor } from '@/features/project/steps'
import { useHeaderSlots } from '@/features/project/headerSlots'
import { ExportSheet } from '@/features/export/ExportSheet'
import { AiError } from '@/ai'
import { authEnabled, promptForAccess } from '@/features/auth/auth'
import { addScene, moveScene, setTargetLength, tellAi, undo, redo } from './editActions'
import { MusicPanel, StylePanel, VoicePanel, type PanelId } from './GlobalPanels'
import { SceneTab } from './SceneTab'
import { SceneStrip } from './SceneStrip'
import { LookPanel } from './LookPanel'
import { AiCard, TellAiSheet } from './TellAi'
import { VersionMenu } from './VersionMenu'
import { useEditorData } from './useEditorData'
import { useMediaQuery } from '@/lib/useMediaQuery'
import '@/features/voice/followVoice' // own voice: script and footage follow what was said
import { ExportSupportNotice } from '@/features/export/ExportSupport'
import { Tour } from '@/features/tutorial/Tour'

const TABS: { id: PanelId; label: string }[] = [
  { id: 'scene', label: 'Scene' },
  { id: 'look', label: 'Look' },
  { id: 'voice', label: 'Voice' },
  { id: 'music', label: 'Music' },
  { id: 'style', label: 'Text' },
]

/**
 * Step 5. Desktop: scene strip on top, the preview with the AI card on the
 * left, one tabbed panel on the right. Phone: preview, strip, sticky tabs,
 * and an Ask AI · Export bar at the bottom.
 */
export function EditStep() {
  const { project, clips } = useProject()
  const plan = currentEdit(project)
  const { timeline, mix, staleMix } = useEditorData(project, plan, clips)
  const [params] = useSearchParams()
  const [tab, setTab] = useState<PanelId>('scene')
  const [selected, setSelected] = useState(0)
  const [seek, setSeek] = useState<{ t: number; n: number }>()
  const [now, setNow] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [stripBusy, setStripBusy] = useState(false)
  const [aiSheet, setAiSheet] = useState(false)
  const [exporting, setExporting] = useState(false)
  const onTime = useCallback((t: number) => setNow(t), [])
  const desktop = useMediaQuery('(min-width: 1024px)')

  // The header is the same as on every step; Edit only adds Export on the right (desktop).
  const canUndo = !!project && project.currentEdit > 0
  const canRedo = !!project && project.currentEdit < project.edits.length - 1
  useEffect(() => {
    useHeaderSlots.setState({
      start: null,
      end: desktop ? (
        <Button variant="ember" className="h-11" onClick={() => setExporting(true)} data-tour="export">
          <Upload className="size-[18px]" strokeWidth={2.4} /> Export
        </Button>
      ) : null,
    })
  }, [desktop])
  useEffect(() => () => useHeaderSlots.setState({ start: null, end: null }), [])
  const steps = stepsFor(project?.voice.mode).length

  if (!project) return null
  if (!plan || !timeline) return <Navigate to={stepPath(project.id, 'generate')} replace />

  const index = Math.min(selected, plan.scenes.length - 1)
  const select = (i: number) => {
    setSelected(i)
    setTab('scene')
    if (timeline.scenes[i]) setSeek({ t: timeline.scenes[i].start + 0.01, n: Date.now() })
  }

  const ask = async (text: string): Promise<boolean> => {
    setThinking(true)
    try {
      if (text === 'Shorter, 20s') {
        await setTargetLength(20)
        const sec = Math.round(timelineSeconds())
        toast(sec > 23 ? `Now ${sec}s: the spoken lines need that long. Remove a line to go shorter.` : `Now about 20s.`, 'success', { label: 'Undo', run: () => void undo() })
      } else {
        await tellAi(text)
        toast(`Done: ${text}`, 'success', { label: 'Undo', run: () => void undo() })
      }
      setAiSheet(false)
      return true
    } catch (e) {
      if (authEnabled && e instanceof AiError && (e.code === 'quota' || e.code === 'auth')) void promptForAccess(e.code, e.message)
      else toast((e as Error).message, 'error')
      return false
    } finally {
      setThinking(false)
    }
  }
  // The new length, read after the change has been saved and re-fitted.
  const timelineSeconds = () => {
    const p = useProject.getState().project
    const e = p && currentEdit(p)
    return e ? e.scenes.reduce((a, s) => a + sumShots(s.shots), 0) : 0
  }

  const strip = async (fn: () => Promise<void>) => {
    setStripBusy(true)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setStripBusy(false)
    }
  }

  const playing = Math.max(0, timeline.scenes.findIndex((s) => now >= s.start && now < s.end))
  const playingLine = project.script?.lines.find((l) => l.id === plan.scenes[playing]?.lineId)
  const music = project.musicTrackId ? ' + music' : ''
  const badge = `Scene ${playing + 1} of ${plan.scenes.length} · ${playingLine ? (project.voice.mode === 'none' ? `captions${music}` : `voice${music}`) : music ? 'music only' : 'clip sound only'}`
  const sceneClip = clips.find((c) => c.id === plan.scenes[index]?.shots[0]?.clipId)

  const stripEl = (
    <SceneStrip
      project={project}
      plan={plan}
      clips={clips}
      timeline={timeline}
      selected={tab === 'scene' ? index : -1}
      now={now}
      compact={!desktop}
      busy={stripBusy}
      onSelect={select}
      onMove={(from, to) =>
        void strip(async () => {
          await moveScene(from, to)
          if (index === from) setSelected(to)
        })
      }
      onAdd={() => void strip(async () => select(await addScene(index)))}
    />
  )

  const tabs = (
    <div role="tablist" aria-label="Edit panels" className={cn('flex rounded-full p-1', desktop ? 'h-[42px] bg-[#0e0d0d]' : 'h-[46px] bg-surface')}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          data-tour={`tab-${t.id}`}
          onClick={() => setTab(t.id)}
          className={cn('min-w-0 flex-1 rounded-full text-[14px] transition duration-150 ease-ember', tab === t.id ? 'bg-white font-bold text-ink' : 'font-medium text-white/72 hover:text-fg')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  const panel = (
    <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
      {tab === 'scene' && <SceneTab key={plan.scenes[index]?.id} project={project} plan={plan} clips={clips} index={index} onIndex={select} timeline={timeline} now={now} />}
      {tab === 'look' && <LookPanel project={project} plan={plan} clips={clips} sceneClip={sceneClip} />}
      {tab === 'voice' && <VoicePanel project={project} />}
      {tab === 'music' && <MusicPanel project={project} />}
      {tab === 'style' && <StylePanel project={project} clips={clips} sceneClip={sceneClip} />}
    </div>
  )

  return (
    <main className="relative mx-auto w-full max-w-[1280px] flex-1 px-4 pt-4 pb-36 lg:px-10 lg:pt-[22px] lg:pb-11">
      <div className="ember-wash -z-10" aria-hidden />
      <ExportSupportNotice className="mb-4" />
      {/* Step heading, as on the other steps; undo, redo and versions on the right */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 lg:mb-6">
        <div className="min-w-0 space-y-1.5">
          <div className="eyebrow">
            Step {steps} of {steps}
          </div>
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-[24px] leading-tight font-extrabold tracking-[-0.03em] lg:text-[30px]">{project.title || 'Untitled vlog'}</h1>
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted" title="Every change is saved on this device as you go">
              <span className="size-1.5 rounded-full bg-success" aria-hidden /> Saved
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RoundIcon label="Undo" disabled={!canUndo} onClick={() => void undo()}>
            <Undo2 className="size-[18px]" strokeWidth={2.4} />
          </RoundIcon>
          <RoundIcon label="Redo" disabled={!canRedo} onClick={() => void redo()}>
            <Redo2 className="size-[18px]" strokeWidth={2.4} />
          </RoundIcon>
          <VersionMenu project={project} />
        </div>
      </div>
      {desktop && stripEl}

      <div className={cn(desktop && 'grid grid-cols-[360px_minmax(0,1fr)] gap-10 pt-7')}>
        <div className={cn('space-y-4', desktop && 'sticky top-[92px] self-start')}>
          <div data-tour="preview" className="flex justify-center">
            <PreviewPlayer edit badge={badge} marks={timeline.scenes.slice(1).map((s) => s.start)} timeline={timeline} project={project} mix={mix ?? staleMix} seek={seek} onTime={onTime} autoPlay={params.get('play') === '1'} />
          </div>
          {desktop && <AiCard thinking={thinking} onAsk={ask} />}
        </div>

        {desktop ? (
          <div className="rounded-[28px] bg-surface px-6 pt-[22px] pb-[26px]">
            {tabs}
            <div className="pt-6">{panel}</div>
          </div>
        ) : (
          <div className="pt-4">
            {stripEl}
            <div className="sticky top-[calc(68px+env(safe-area-inset-top))] z-20 -mx-4 mt-3 bg-[rgb(9_9_10/.92)] px-4 py-2 backdrop-blur-[14px]">{tabs}</div>
            <div className="pt-4">{panel}</div>
          </div>
        )}
      </div>

      {!desktop && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2.5 bg-gradient-to-b from-transparent to-bg to-32% px-4 pt-[14px] pb-[max(30px,env(safe-area-inset-bottom))]">
          <Button variant="quiet" className="min-w-0 flex-1 justify-start" onClick={() => setAiSheet(true)} data-tour="tell-ai">
            <Sparkles className="size-[18px] text-ember-300" strokeWidth={2.2} /> Ask AI
          </Button>
          <Button variant="ember" onClick={() => setExporting(true)} data-tour="export">
            Export
          </Button>
        </div>
      )}

      {!exporting && !aiSheet && <Tour page="edit" />}
      <TellAiSheet open={aiSheet} onClose={() => setAiSheet(false)} thinking={thinking} onAsk={ask} />
      {exporting && <ExportSheet project={project} timeline={timeline} clips={clips} onClose={() => setExporting(false)} />}
    </main>
  )
}

function RoundIcon({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-10 shrink-0 place-items-center rounded-full bg-white/6 transition hover:bg-white/10 disabled:text-white/35 disabled:hover:bg-white/6">
      {children}
    </button>
  )
}
