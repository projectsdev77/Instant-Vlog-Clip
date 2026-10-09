import { arrayMove } from '@dnd-kit/sortable'
import { refitPlan } from '@/domain/repair'
import { shotFromMoment } from '@/domain/shots'
import type { EditPlan, Moment, Project, Scene } from '@/domain/types'
import { currentEdit, useProject } from '@/store/projectStore'
import { planContext, planWithAi } from '@/pipeline/generate'
import { voiceAllLines, voiceLine } from '@/pipeline/voice'
import { deleteMedia } from '@/lib/mediaStore'

const state = () => useProject.getState()

function requireEdit(): { project: Project; plan: EditPlan } {
  const { project } = state()
  const plan = currentEdit(project)
  if (!project || !plan) throw new Error('No edit to change')
  return { project, plan }
}

/** Saves a changed plan as a new version after re-fitting it to the script timings. */
export async function commit(plan: EditPlan, note?: string) {
  const project = state().project!
  const fitted = refitPlan(plan, planContext(project))
  await state().pushEdit({ ...fitted, createdBy: 'user', createdAt: Date.now(), note: note ?? fitted.note })
}

/** Re-fits the current version in place (after timings changed, e.g. new voice). */
async function refitCurrent() {
  const { project, plan } = requireEdit()
  await state().replaceCurrentEdit(refitPlan(plan, planContext(project)))
}

const mapScenes = (plan: EditPlan, fn: (s: Scene[]) => Scene[]): EditPlan => ({ ...plan, scenes: fn(plan.scenes) })

export async function moveScene(from: number, to: number) {
  const { project, plan } = requireEdit()
  if (to < 0 || to >= plan.scenes.length) return
  const lineOrder = arrayMove(plan.scenes, from, to).map((s) => s.lineId)
  if (project.script && lineOrder.every(Boolean)) {
    const byId = new Map(project.script.lines.map((l) => [l.id, l]))
    await state().updateProject({ script: { ...project.script, lines: lineOrder.map((id) => byId.get(id!)!).filter(Boolean) } })
  }
  await commit(mapScenes(plan, (s) => arrayMove(s, from, to)), 'Moved a scene')
}

export async function deleteScene(index: number) {
  const { project, plan } = requireEdit()
  if (plan.scenes.length <= 1) throw new Error('A vlog needs at least one scene.')
  const scene = plan.scenes[index]
  if (scene.lineId && project.script) {
    const line = project.script.lines.find((l) => l.id === scene.lineId)
    if (line?.audio) void deleteMedia(line.audio.mediaKey)
    await state().updateProject({ script: { ...project.script, lines: project.script.lines.filter((l) => l.id !== scene.lineId) } })
  }
  await commit(mapScenes(plan, (s) => s.filter((_, i) => i !== index)), 'Removed a scene')
}

export async function swapShot(sceneIndex: number, shotIndex: number, clipId: string, moment: Moment) {
  const { plan } = requireEdit()
  const clip = state().clips.find((c) => c.id === clipId)
  if (!clip) return
  const old = plan.scenes[sceneIndex].shots[shotIndex]
  const shot = { ...shotFromMoment(clip, moment, old.out - old.in, { clipAudio: old.clipAudio, transitionIn: old.transitionIn }), id: old.id }
  await commit(
    mapScenes(plan, (scenes) => scenes.map((s, i) => (i !== sceneIndex ? s : { ...s, shots: s.shots.map((x, j) => (j === shotIndex ? shot : x)) }))),
    'Swapped a shot',
  )
}

/** Trims edit the current version in place (no new version). */
export async function trimShot(sceneIndex: number, shotIndex: number, inPoint: number, outPoint: number) {
  const { project, plan } = requireEdit()
  const changed = mapScenes(plan, (scenes) =>
    scenes.map((s, i) => (i !== sceneIndex ? s : { ...s, shots: s.shots.map((x, j) => (j === shotIndex ? { ...x, in: inPoint, out: outPoint } : x)) })),
  )
  await state().replaceCurrentEdit(refitPlan(changed, planContext(project)))
}

export async function setShotAudio(sceneIndex: number, shotIndex: number, clipAudio: 'mute' | 'duck' | 'full') {
  const { plan } = requireEdit()
  await state().replaceCurrentEdit(
    mapScenes(plan, (scenes) => scenes.map((s, i) => (i !== sceneIndex ? s : { ...s, shots: s.shots.map((x, j) => (j === shotIndex ? { ...x, clipAudio } : x)) }))),
  )
}

/** Changes a line's words; AI voice is regenerated for just that line. */
export async function editLine(lineId: string, text: string) {
  const { project, plan } = requireEdit()
  if (!project.script) return
  const lines = project.script.lines.map((l) => (l.id === lineId ? { ...l, text } : l))
  await state().updateProject({ script: { ...project.script, lines } })
  const fresh = state().project!
  const line = fresh.script!.lines.find((l) => l.id === lineId)!
  if (fresh.voice.mode === 'ai') await voiceLine(line, fresh.voice.voiceId, fresh.settings.language)
  await commit(plan, 'Rewrote a line')
}

export async function changeVoice(voiceId: string) {
  await state().updateProject((p) => ({ voice: { ...p.voice, voiceId, mode: 'ai' } }))
  await voiceAllLines()
  await refitCurrent()
}

export async function tellAi(feedback: string) {
  const { project, plan } = requireEdit()
  const { plan: next, usedFallback } = await planWithAi(planContext(project), { feedback, current: plan })
  if (usedFallback) throw new Error("The AI editor isn't available right now. Try again in a moment.")
  await state().pushEdit({ ...next, createdBy: 'ai', note: `“${feedback}”` })
}

export async function regenerate() {
  const { project } = requireEdit()
  const { plan } = await planWithAi(planContext(project))
  await state().pushEdit(plan)
}

export async function undo() {
  await state().updateProject((p) => ({ currentEdit: Math.max(0, p.currentEdit - 1) }))
}

export async function redo() {
  await state().updateProject((p) => ({ currentEdit: Math.min(p.edits.length - 1, p.currentEdit + 1) }))
}
