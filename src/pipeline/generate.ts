import type { CatalogEntry, PlanLine } from '@shared/contracts.ts'
import { ai, AiError } from '@/ai'
import { buildCatalog } from '@/ai/catalog'
import { planToWire } from '@/ai/wire'
import { planTemplate, resolveTemplate, stylize } from '@/domain/templates'
import { planFallback } from '@/domain/fallback'
import { sceneDuration, videoTargetSec, type PlanContext } from '@/domain/planContext'
import { repairPlan } from '@/domain/repair'
import { sumShots } from '@/domain/shots'
import type { EditPlan, Project } from '@/domain/types'
import { pickTrack, trackById } from '@/render/musicTracks'
import { currentEdit, useProject } from '@/store/projectStore'
import { analyzeClipsUpTo } from './analysis'
import { voiceAllLines } from './voice'
import { transcribeAll } from './voiceTrack'

export type Stage = 'watching' | 'voicing' | 'picking' | 'cutting' | 'finishing'

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'watching', label: 'Watching your clips' },
  { id: 'voicing', label: 'Voicing your script' },
  { id: 'picking', label: 'Picking the best moments' },
  { id: 'cutting', label: 'Cutting it together' },
  { id: 'finishing', label: 'Adding captions & music' },
]

export type Progress = { stage: Stage; detail?: string; fraction?: number }

/** Music mood: the template's, or the project's vibe for templates that suit any mood. */
function musicVibe(p: Project) {
  const t = resolveTemplate(p.settings.template, p.settings.vibe)
  return t.vibe === 'auto' ? p.settings.vibe : t.vibe
}

/**
 * Own voice ("Record my own"): once the vlog is made, its scene timing is what
 * the voice is (or will be) recorded against, so the AI and re-fits keep it.
 */
export function recordedLayout(p: Project) {
  const plan = currentEdit(p)
  if (p.voice.mode !== 'recorded' || !plan) return undefined
  return plan.scenes.map((s) => ({ lineId: s.lineId, sec: sumShots(s.shots) }))
}

/**
 * `fixedLayout`: keep the recorded scene structure exactly (Tell the AI, make
 * again). Re-fits after user edits only keep the line lengths.
 */
export function planContext(p: Project, clips = useProject.getState().clips, opts: { fixedLayout?: boolean } = {}): PlanContext {
  const lines = p.script?.lines.filter((l) => l.text.trim()) ?? []
  const layout = recordedLayout(p)
  return {
    sceneSec: layout && new Map(layout.filter((s) => s.lineId).map((s) => [s.lineId!, s.sec])),
    fixedLayout: opts.fixedLayout ? layout : undefined,
    clips: clips.filter((c) => c.status !== 'error' && c.durationSec > 0),
    script: lines.length ? { ...p.script!, lines } : undefined,
    voiceMode: p.voice.mode,
    settings: p.settings,
    title: p.title || p.script?.title || 'My vlog',
    musicTrackId: p.musicTrackId === 'auto' ? pickTrack(musicVibe(p), p.clipIds.length).id : p.musicTrackId,
    musicGainDb: p.musicGainDb,
  }
}

/** Asks the AI for a plan, validates it, retries once with the problems listed, falls back to rules. */
export async function planWithAi(ctx: PlanContext, opts: { feedback?: string; current?: EditPlan } = {}): Promise<{ plan: EditPlan; usedFallback: boolean }> {
  const catalog: CatalogEntry[] = buildCatalog(ctx.clips)
  const template = resolveTemplate(opts.current?.templateId ?? ctx.settings.template, ctx.settings.vibe)
  const lines: PlanLine[] = (ctx.script?.lines ?? []).map((l) => ({ lineId: l.id, text: l.text, visualIntent: l.visualIntent, sceneSec: Math.round(sceneDuration(ctx, l) * 100) / 100 }))
  const base = {
    aspect: ctx.settings.aspect,
    vibe: ctx.settings.vibe,
    narrated: ctx.voiceMode !== 'none' && lines.length > 0,
    lines,
    targetSec: Math.round(videoTargetSec(ctx)),
    catalog,
    feedback: opts.feedback,
    currentPlan: opts.current ? planToWire(opts.current) : undefined,
    template: planTemplate(template),
    layout: ctx.fixedLayout?.map((x) => ({ lineId: x.lineId ?? '', sceneSec: Math.round(x.sec * 100) / 100 })),
  }
  const finish = (plan: EditPlan, fromAi: boolean): EditPlan =>
    stylize(plan, template, {
      keepChoices: fromAi,
      topUp: !opts.feedback,
      // Beat sync moves cuts; over a recorded voice the timing must stay put.
      bpm: ctx.fixedLayout ? undefined : trackById(ctx.musicTrackId)?.bpm,
      clipDurations: new Map(ctx.clips.map((c) => [c.id, c.durationSec])),
      look: opts.current?.templateId === template.id ? opts.current.look : undefined,
      fades: opts.current?.templateId === template.id ? opts.current.fades : undefined,
    })
  let previousIssues: string[] | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: unknown
    try {
      raw = await ai.planEdit({ ...base, previousIssues })
    } catch (e) {
      if (e instanceof AiError && (e.code === 'quota' || e.code === 'auth')) throw e
      console.warn('Planner failed', e)
      break
    }
    const result = repairPlan(raw, ctx)
    const serious = result.issues.filter((i) => !i.includes('outside clip'))
    if (!result.usedFallback && (serious.length === 0 || attempt === 1)) return { plan: finish(result.plan, true), usedFallback: false }
    previousIssues = result.issues
  }
  const plan = finish(repairPlan(planToWire(planFallback(ctx)), ctx, 'fallback').plan, false)
  return { plan: { ...plan, note: "Made a simple edit because the AI editor wasn't available." }, usedFallback: true }
}

let running: Promise<void> | null = null

/** The whole Generate step. Safe to call twice; the second call joins the first. */
export function generateVlog(onProgress: (p: Progress) => void): Promise<void> {
  running ??= run(onProgress).finally(() => {
    running = null
  })
  return running
}

async function run(onProgress: (p: Progress) => void) {
  const store = useProject.getState()
  if (!store.project) return

  onProgress({ stage: 'watching' })
  // At most 60 s: clips the AI hasn't finished are edited from on-device signals.
  await analyzeClipsUpTo(60_000, (done, total) => onProgress({ stage: 'watching', detail: `${done} of ${total} clips`, fraction: total ? done / total : 1 }))

  let project = useProject.getState().project!
  const usable = useProject.getState().clips.filter((c) => c.status !== 'error' && c.durationSec > 0)
  if (!usable.length) throw new Error('None of your clips could be read. Add a few more clips and try again.')

  onProgress({ stage: 'voicing' })
  if (project.voice.mode === 'ai') {
    await voiceAllLines((done, total) => onProgress({ stage: 'voicing', detail: total ? `${done} of ${total} lines` : undefined, fraction: total ? done / total : 1 }))
  } else if (project.voice.mode === 'recorded' && project.voiceTrack?.takes.length) {
    // Captions come from what was said in each take.
    onProgress({ stage: 'voicing', detail: 'Making captions from your voice' })
    await transcribeAll()
  }

  project = useProject.getState().project!
  onProgress({ stage: 'picking' })
  const ctx = planContext(project, undefined, { fixedLayout: true })
  const { plan } = await planWithAi(ctx)

  onProgress({ stage: 'cutting' })
  onProgress({ stage: 'finishing' })
  await useProject.getState().updateProject({ musicTrackId: ctx.musicTrackId ?? null, styleId: resolveTemplate(ctx.settings.template, ctx.settings.vibe).styleId })
  await useProject.getState().pushEdit(plan.createdBy === 'fallback' ? plan : { ...plan, note: 'First cut' })
  // "Record my own": the voice is recorded next, over the finished video.
  await useProject.getState().updateProject({ step: afterMake(useProject.getState().project!) })
}

/** Where Make leads: the Record page when the user's own voice is still to be recorded. */
export const afterMake = (p: Project) => (p.voice.mode === 'recorded' && !p.voiceTrack?.takes.length ? 'record' : 'edit')

export const hasEdit = (p: Project | null) => !!currentEdit(p)
