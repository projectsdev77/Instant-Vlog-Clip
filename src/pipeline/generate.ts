import type { CatalogEntry, PlanLine, PlanResponse } from '@shared/contracts.ts'
import { ai, AiError } from '@/ai'
import { buildCatalog } from '@/ai/catalog'
import { planFallback } from '@/domain/fallback'
import type { PlanContext } from '@/domain/planContext'
import { targetTotalSec } from '@/domain/planContext'
import { repairPlan } from '@/domain/repair'
import { hasFreshAudio, lineSceneDuration } from '@/domain/timing'
import type { EditPlan, Project } from '@/domain/types'
import { pickTrack } from '@/render/musicTracks'
import { currentEdit, useProject } from '@/store/projectStore'
import { analyzeClipsInBackground, analysisProgress } from './analysis'
import { voiceAllLines } from './voice'

export type Stage = 'watching' | 'voicing' | 'picking' | 'cutting' | 'finishing'

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'watching', label: 'Watching your clips' },
  { id: 'voicing', label: 'Voicing your script' },
  { id: 'picking', label: 'Picking the best moments' },
  { id: 'cutting', label: 'Cutting it together' },
  { id: 'finishing', label: 'Adding captions & music' },
]

export type Progress = { stage: Stage; detail?: string; fraction?: number }

export function planContext(p: Project, clips = useProject.getState().clips): PlanContext {
  const lines = p.script?.lines.filter((l) => l.text.trim()) ?? []
  return {
    clips: clips.filter((c) => c.status !== 'error' && c.durationSec > 0),
    script: lines.length ? { ...p.script!, lines } : undefined,
    voiceMode: p.voice.mode,
    settings: p.settings,
    title: p.title || p.script?.title || 'My vlog',
    musicTrackId: p.musicTrackId === 'auto' ? pickTrack(p.settings.vibe, p.clipIds.length).id : p.musicTrackId,
    musicGainDb: p.musicGainDb,
  }
}

function toWire(plan: EditPlan): PlanResponse {
  return {
    note: plan.note ?? '',
    scenes: plan.scenes.map((s) => ({
      lineId: s.lineId ?? '',
      shots: s.shots.map((x) => ({ clipId: x.clipId, in: x.in, out: x.out, focusX: x.crop.focusX, focusY: x.crop.focusY, clipAudio: x.clipAudio, transitionIn: x.transitionIn })),
    })),
  }
}

/** Asks the AI for a plan, validates it, retries once with the problems listed, falls back to rules. */
export async function planWithAi(ctx: PlanContext, opts: { feedback?: string; current?: EditPlan } = {}): Promise<{ plan: EditPlan; usedFallback: boolean }> {
  const catalog: CatalogEntry[] = buildCatalog(ctx.clips)
  const lines: PlanLine[] = (ctx.script?.lines ?? []).map((l) => ({ lineId: l.id, text: l.text, visualIntent: l.visualIntent, sceneSec: Math.round(lineSceneDuration(l, ctx.voiceMode) * 100) / 100 }))
  const base = {
    aspect: ctx.settings.aspect,
    vibe: ctx.settings.vibe,
    narrated: ctx.voiceMode !== 'none' && lines.length > 0,
    lines,
    targetSec: targetTotalSec(ctx.settings),
    catalog,
    feedback: opts.feedback,
    currentPlan: opts.current ? toWire(opts.current) : undefined,
  }
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
    if (!result.usedFallback && (serious.length === 0 || attempt === 1)) return { plan: result.plan, usedFallback: false }
    previousIssues = result.issues
  }
  const plan = planFallback(ctx)
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
  const watch = analyzeClipsInBackground({ waitForImports: true })
  const ticker = setInterval(() => {
    const { done, total } = analysisProgress(useProject.getState().clips)
    onProgress({ stage: 'watching', detail: `${done} of ${total} clips`, fraction: total ? done / total : 1 })
  }, 300)
  try {
    await watch
  } finally {
    clearInterval(ticker)
  }

  let project = useProject.getState().project!
  const usable = useProject.getState().clips.filter((c) => c.status !== 'error' && c.durationSec > 0)
  if (!usable.length) throw new Error('None of your clips could be read. Add a few more clips and try again.')

  onProgress({ stage: 'voicing' })
  if (project.voice.mode === 'ai') {
    await voiceAllLines((done, total) => onProgress({ stage: 'voicing', detail: total ? `${done} of ${total} lines` : undefined, fraction: total ? done / total : 1 }))
  } else if (project.voice.mode === 'recorded') {
    const missing = project.script?.lines.filter((l) => !hasFreshAudio(l)).length ?? 0
    if (missing) throw new Error(`${missing} line${missing > 1 ? 's are' : ' is'} not recorded yet. Go back to Voice to record ${missing > 1 ? 'them' : 'it'}.`)
  }

  project = useProject.getState().project!
  onProgress({ stage: 'picking' })
  const ctx = planContext(project)
  const { plan } = await planWithAi(ctx)

  onProgress({ stage: 'cutting' })
  onProgress({ stage: 'finishing' })
  await useProject.getState().updateProject({ musicTrackId: ctx.musicTrackId ?? null })
  await useProject.getState().pushEdit(plan.createdBy === 'fallback' ? plan : { ...plan, note: 'First cut' })
  await useProject.getState().updateProject({ step: 'edit' })
}

export const hasEdit = (p: Project | null) => !!currentEdit(p)
