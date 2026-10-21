import { arrayMove } from '@dnd-kit/sortable'
import { refitPlan } from '@/domain/repair'
import { round, shotFromMoment, shotLength, sourceTime, speedOf } from '@/domain/shots'
import { resolveTemplate, setSpeed, stylize } from '@/domain/templates'
import { uid } from '@/domain/ids'
import { trackById } from '@/render/musicTracks'
import { DEFAULT_LOOK, type EditPlan, type Look, type Moment, type Project, type Scene, type Shot, type TemplateId } from '@/domain/types'
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
  // Footage-only scenes have no line; the narrated ones set the script order.
  const lineOrder = arrayMove(plan.scenes, from, to).map((s) => s.lineId).filter(Boolean)
  if (project.script && lineOrder.length === project.script.lines.length) {
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
  const fresh = shotFromMoment(clip, moment, shotLength(old) * speedOf(old), { clipAudio: old.clipAudio, transitionIn: old.transitionIn })
  const shot: Shot = { ...old, clipId: fresh.clipId, in: fresh.in, out: fresh.out, crop: fresh.crop, hold: undefined }
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
  const { plan: next, usedFallback } = await planWithAi(planContext(project, undefined, { fixedLayout: true }), { feedback, current: plan })
  if (usedFallback) throw new Error("The AI editor isn't available right now. Try again in a moment.")
  await state().pushEdit({ ...next, createdBy: 'ai', note: `“${feedback}”` })
}

export async function regenerate() {
  const { project } = requireEdit()
  const { plan } = await planWithAi(planContext(project, undefined, { fixedLayout: true }))
  await state().pushEdit(plan)
}

export async function undo() {
  await state().updateProject((p) => ({ currentEdit: Math.max(0, p.currentEdit - 1) }))
}

export async function redo() {
  await state().updateProject((p) => ({ currentEdit: Math.min(p.edits.length - 1, p.currentEdit + 1) }))
}

const mapShot = (plan: EditPlan, sceneIndex: number, shotIndex: number, fn: (s: Shot) => Shot | Shot[]): EditPlan =>
  mapScenes(plan, (scenes) => scenes.map((s, i) => (i !== sceneIndex ? s : { ...s, shots: s.shots.flatMap((x, j) => (j === shotIndex ? fn(x) : [x])) })))

const clipDurations = () => new Map(state().clips.map((c) => [c.id, c.durationSec]))

/** Changes effects on one shot (transition, camera move, fit, volume). */
export async function updateShot(sceneIndex: number, shotIndex: number, patch: Partial<Shot>, note: string) {
  const { plan } = requireEdit()
  await commit(mapShot(plan, sceneIndex, shotIndex, (s) => ({ ...s, ...patch })), note)
}

/** Volume changes while dragging edit the current version in place. */
export async function setShotVolume(sceneIndex: number, shotIndex: number, volume: number) {
  const { plan } = requireEdit()
  await state().replaceCurrentEdit(mapShot(plan, sceneIndex, shotIndex, (s) => ({ ...s, volume })))
}

/** Speed or speed curve; the shot keeps its length in the vlog and uses more or less footage. */
export async function setShotSpeed(sceneIndex: number, shotIndex: number, speed: number, ramp: Shot['ramp'] = 'none') {
  const { plan } = requireEdit()
  await commit(
    mapShot(plan, sceneIndex, shotIndex, (s) => {
      const next = { ...s, hold: undefined, ramp: ramp === 'none' ? undefined : ramp }
      setSpeed(next, speed, clipDurations())
      if (next.ramp) next.clipAudio = 'mute'
      return next
    }),
    ramp !== 'none' ? 'Speed ramp' : speed === 1 ? 'Normal speed' : `${speed}× speed`,
  )
}

/** Where in a shot to cut: at the playhead if it's inside the shot, else the middle. */
function cutPoint(s: Shot, local: number | undefined): number {
  const len = shotLength(s)
  return local !== undefined && local > 0.3 && local < len - 0.3 ? local : len / 2
}

export async function splitShot(sceneIndex: number, shotIndex: number, local?: number) {
  const { plan } = requireEdit()
  await commit(
    mapShot(plan, sceneIndex, shotIndex, (s) => {
      if (s.hold) {
        const at = cutPoint(s, local)
        return [{ ...s, hold: round(at) }, { ...s, id: uid('s_'), hold: round(s.hold - at), transitionIn: 'cut' }]
      }
      const src = round(sourceTime(s, cutPoint(s, local)))
      const base = { ...s, ramp: undefined }
      return [
        { ...base, out: src },
        { ...base, id: uid('s_'), in: src, transitionIn: 'cut' },
      ]
    }),
    'Split a shot',
  )
}

/** Inserts a 1 s freeze frame at the playhead (or the middle of the shot). */
export async function freezeFrame(sceneIndex: number, shotIndex: number, local?: number) {
  const { plan } = requireEdit()
  await commit(
    mapShot(plan, sceneIndex, shotIndex, (s) => {
      const at = cutPoint(s, local)
      const src = round(sourceTime(s, at))
      if (s.hold) return [s, { ...s, id: uid('s_'), transitionIn: 'cut', hold: 1 }]
      const base = { ...s, ramp: undefined }
      return [
        { ...base, out: src },
        { ...base, id: uid('s_'), in: src, out: src, hold: 1, speed: undefined, motion: 'punch', clipAudio: 'mute', transitionIn: 'flash' },
        { ...base, id: uid('s_'), in: src, transitionIn: 'cut' },
      ]
    }),
    'Freeze frame',
  )
}

/** Copies a shot into a new footage-only scene right after this scene. */
export async function duplicateShot(sceneIndex: number, shotIndex: number) {
  const { plan } = requireEdit()
  const copy = { ...plan.scenes[sceneIndex].shots[shotIndex], id: uid('s_'), transitionIn: 'cut' as const }
  await commit(
    mapScenes(plan, (scenes) => [...scenes.slice(0, sceneIndex + 1), { id: uid('sc_'), shots: [copy] }, ...scenes.slice(sceneIndex + 1)]),
    'Duplicated a shot',
  )
}

export async function deleteShot(sceneIndex: number, shotIndex: number) {
  const { plan } = requireEdit()
  if (plan.scenes[sceneIndex].shots.length <= 1) return deleteScene(sceneIndex)
  await commit(mapShot(plan, sceneIndex, shotIndex, () => []), 'Removed a shot')
}

/** Look changes: `live` edits in place (while dragging), otherwise saves a new version. */
export async function setLook(patch: Partial<Look>, live = false) {
  const { plan } = requireEdit()
  const tl = { ...plan, look: { ...(plan.look ?? DEFAULT_LOOK), ...patch } }
  if (live) await state().replaceCurrentEdit(tl)
  else await commit(tl, 'Changed the look')
}

export async function setFades(fades: { in: boolean; out: boolean }) {
  const { plan } = requireEdit()
  await commit({ ...plan, fades }, fades.in || fades.out ? 'Fades' : 'No fades')
}

/** Restyles the current edit with another template, keeping the footage. */
export async function applyTemplate(id: TemplateId) {
  const { project, plan } = requireEdit()
  const t = resolveTemplate(id, project.settings.vibe)
  const next = stylize(plan, t, { bpm: trackById(project.musicTrackId)?.bpm, clipDurations: clipDurations() })
  await state().updateProject((p) => ({ styleId: t.styleId, settings: { ...p.settings, template: id } }))
  await commit(next, `${t.name} template`)
}
