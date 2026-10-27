import { arrayMove } from '@dnd-kit/sortable'
import { refitPlan } from '@/domain/repair'
import { MIN_SHOT } from '@/domain/timing'
import { fitShots, round, shotFromMoment, shotLength, sourceTime, speedOf, sumShots } from '@/domain/shots'
import { pickFootage } from '@/domain/pickFootage'
import { withHandEdit } from '@/domain/handEdits'
import { scriptFromSpeech } from '@/domain/voiceTrack'
import { resolveTemplate, setSpeed, stylize } from '@/domain/templates'
import { uid } from '@/domain/ids'
import { trackById } from '@/render/musicTracks'
import { DEFAULT_LOOK, type EditPlan, type Look, type Moment, type Project, type Scene, type Shot, type TemplateId, type VoiceMode, type Delivery, type EditGlobals, type HandEdit, type ScriptLine, type TargetLength } from '@/domain/types'
import { currentEdit, useProject } from '@/store/projectStore'
import { planContext } from '@/pipeline/generate'
import { linesNeedingVoice, voiceAllLines, voiceLine } from '@/pipeline/voice'

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
    mapShot(plan, sceneIndex, shotIndex, 'footage', () => shot),
    'Swapped a shot',
  )
}

/** Trims edit the current version in place (no new version). */
export async function trimShot(sceneIndex: number, shotIndex: number, inPoint: number, outPoint: number) {
  const { project, plan } = requireEdit()
  const changed = mapShot(plan, sceneIndex, shotIndex, 'footage', (x) => ({ ...x, in: inPoint, out: outPoint }))
  await state().replaceCurrentEdit(refitPlan(changed, planContext(project)))
}

export async function setShotAudio(sceneIndex: number, shotIndex: number, clipAudio: 'mute' | 'duck' | 'full') {
  const { plan } = requireEdit()
  await state().replaceCurrentEdit(mapShot(plan, sceneIndex, shotIndex, 'sound', (x) => ({ ...x, clipAudio })))
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
  await commit(wordsEdited(plan, lineId), 'Rewrote a line')
}

async function patchLine(lineId: string, patch: Partial<ScriptLine>) {
  const { project } = requireEdit()
  if (!project.script) return
  await state().updateProject({ script: { ...project.script, lines: project.script.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) } })
  const fresh = state().project!
  const line = fresh.script!.lines.find((l) => l.id === lineId)!
  if (fresh.voice.mode === 'ai' && linesNeedingVoice(fresh).some((l) => l.id === lineId)) await voiceLine(line, fresh.voice.voiceId, fresh.settings.language)
}

/**
 * Adds a narrated line: to a footage-only scene, or as a new scene after
 * `sceneIndex` (footage is picked for it). Returns the scene it landed in.
 */
export async function addLine(sceneIndex: number, text: string): Promise<number> {
  const { project, plan } = requireEdit()
  const intoScene = !plan.scenes[sceneIndex].lineId
  const line: ScriptLine = { id: uid('ln_'), text, purpose: 'story', visualIntent: text }
  // The script follows the scene order: the new line goes after the last line before it.
  const prev = plan.scenes
    .slice(0, sceneIndex + 1)
    .map((s) => s.lineId)
    .filter(Boolean)
    .pop()
  const lines = [...(project.script?.lines ?? [])]
  lines.splice(prev ? lines.findIndex((l) => l.id === prev) + 1 : 0, 0, line)
  await state().updateProject({ script: { title: project.script?.title ?? project.title, lines } })
  const fresh = state().project!
  if (fresh.voice.mode === 'ai') await voiceLine(line, fresh.voice.voiceId, fresh.settings.language)
  const scenes = intoScene
    ? plan.scenes.map((s, i) => (i === sceneIndex ? { ...s, lineId: line.id } : s))
    : [...plan.scenes.slice(0, sceneIndex + 1), { id: uid('sc_'), lineId: line.id, shots: [] }, ...plan.scenes.slice(sceneIndex + 1)]
  await commit(wordsEdited({ ...plan, scenes }, line.id), 'Added a line')
  return state().project!.edits[state().project!.currentEdit].scenes.findIndex((s) => s.lineId === line.id)
}

// Own voice, on the Record page: lines are a guide and every scene keeps its
// length, so nothing already recorded moves.

const pushUserEdit = (plan: EditPlan, scenes: Scene[], note: string) => state().pushEdit({ ...plan, scenes, createdBy: 'user', createdAt: Date.now(), note })

const setScriptLines = (project: Project, lines: ScriptLine[]) => state().updateProject({ script: { title: project.script?.title ?? project.title, lines } })

/** Rewrites a line; with `newFootage` its scene gets footage that suits the new words (same length). */
export async function replaceLineKeepTime(lineId: string, text: string, newFootage: boolean) {
  const { project, plan } = requireEdit()
  await setScriptLines(
    project,
    (project.script?.lines ?? []).map((l) => (l.id === lineId ? { ...l, text, visualIntent: text } : l)),
  )
  const i = plan.scenes.findIndex((s) => s.lineId === lineId)
  if (!newFootage || i < 0) return
  const shots = pickFootage(text, state().clips, plan, i, sumShots(plan.scenes[i].shots))
  await pushUserEdit(plan, plan.scenes.map((s, j) => (j === i ? { ...s, shots } : s)), 'New footage for a line')
}

/** Drops a line; its scene stays, as footage only. */
export async function removeLineKeepTime(lineId: string) {
  const { project, plan } = requireEdit()
  await setScriptLines(project, (project.script?.lines ?? []).filter((l) => l.id !== lineId))
  await pushUserEdit(plan, plan.scenes.map((s) => (s.lineId === lineId ? { ...s, lineId: undefined } : s)), 'Removed a line')
}

/**
 * "Say my own thing": the script becomes what was said in each recorded part,
 * and those parts get footage that suits the words. Lengths never change.
 */
export async function matchScriptToVoice(): Promise<number> {
  const { project, plan } = requireEdit()
  const r = scriptFromSpeech(plan, project.script?.lines ?? [], project.voiceTrack?.takes ?? [])
  if (!r.changed.length) return 0
  const draft = { ...plan, scenes: r.scenes }
  const scenes = r.scenes.map((s, i) => {
    const line = s.lineId && r.changed.includes(i) ? r.lines.find((l) => l.id === s.lineId) : undefined
    return line ? { ...s, shots: pickFootage(line.text, state().clips, draft, i, sumShots(s.shots)) } : s
  })
  await setScriptLines(project, r.lines)
  await pushUserEdit(plan, scenes, 'Script and footage follow what you said')
  return r.changed.length
}

/** Shortest part a scene can be split into when a line is added. */
export const MIN_LINE_PART = 1

/**
 * Adds a line at timeline time `t`. A footage-only scene there takes the line;
 * a scene that has one is split at `t` and the new line gets the second part.
 * Either way the part gets fresh footage and the total timing is unchanged.
 */
export async function addLineAt(t: number, text: string) {
  const { project, plan } = requireEdit()
  let start = 0
  const i = plan.scenes.findIndex((s) => {
    const end = start + sumShots(s.shots)
    if (t < end) return true
    start = end
    return false
  })
  if (i < 0) throw new Error('Move the playhead inside the video first.')
  const scene = plan.scenes[i]
  const len = sumShots(scene.shots)
  const line: ScriptLine = { id: uid('ln_'), text, purpose: 'story', visualIntent: text }
  const split = !!scene.lineId
  if (split && (t - start < MIN_LINE_PART || start + len - t < MIN_LINE_PART)) throw new Error('Move the playhead at least a second away from where a line starts or ends.')

  // The script follows the scene order: the new line goes after the last line before it.
  const prev = plan.scenes
    .slice(0, i + 1)
    .map((s) => s.lineId)
    .filter(Boolean)
    .pop()
  const lines = [...(project.script?.lines ?? [])]
  lines.splice(prev ? lines.findIndex((l) => l.id === prev) + 1 : 0, 0, line)
  await setScriptLines(project, lines)

  const clips = new Map(state().clips.map((c) => [c.id, c]))
  const scenes = split
    ? [
        ...plan.scenes.slice(0, i),
        { ...scene, shots: fitShots(scene.shots, round(t - start), clips).shots },
        { id: uid('sc_'), lineId: line.id, shots: pickFootage(text, state().clips, plan, i, round(start + len - t)) },
        ...plan.scenes.slice(i + 1),
      ]
    : plan.scenes.map((s, j) => (j === i ? { ...s, lineId: line.id, shots: pickFootage(text, state().clips, plan, i, len) } : s))
  await pushUserEdit(plan, scenes, 'Added a line')
}

/** AI voice off for one line: it stays as a caption, its scene keeps reading time. */
export async function setLineMuted(lineId: string, muted: boolean) {
  const { plan } = requireEdit()
  await patchLine(lineId, { muted })
  await commit(wordsEdited(plan, lineId), muted ? 'Muted a line' : 'Unmuted a line')
}

/** Reads a line again: a different take, optionally in another delivery. */
export async function rereadLine(lineId: string, delivery: Delivery) {
  const { plan } = requireEdit()
  await patchLine(lineId, { delivery, seed: Math.floor(Math.random() * 1_000_000_000) })
  await commit(wordsEdited(plan, lineId), delivery === 'natural' ? 'Read a line again' : `Read a line again (${DELIVERY_LABEL[delivery].toLowerCase()})`)
}

export const DELIVERY_LABEL: Record<Delivery, string> = { natural: 'Natural', calm: 'Calmer', energetic: 'More energy', slow: 'Slower' }

export async function changeVoice(voiceId: string) {
  await state().updateProject((p) => ({ voice: { ...p.voice, voiceId, mode: 'ai' } }))
  await voiceAllLines()
  await refitCurrent()
}

/** Switches between AI voice, own voice and captions only; scenes re-fit to the new timing. */
export async function setVoiceMode(mode: VoiceMode) {
  if (mode === 'ai') return changeVoice(state().project!.voice.voiceId)
  await state().updateProject((p) => ({ voice: { ...p.voice, mode } }))
  await refitCurrent()
}

/** How long the title shows: 0 = not at all, a number of seconds, or the whole video. */
export async function setTitleShow(showUntilSec: number | 'always') {
  const { plan } = requireEdit()
  await commit({ ...plan, title: { ...plan.title, showUntilSec } }, showUntilSec === 0 ? 'Title hidden' : showUntilSec === 'always' ? 'Title on the whole video' : 'Title at the start')
}

export const restoreGlobals = (p: Project, g: EditGlobals): Partial<Project> => ({ title: g.title, musicTrackId: g.musicTrackId, musicGainDb: g.musicGainDb, styleId: g.styleId, voice: g.voice, settings: { ...p.settings, targetSec: g.targetSec } })

/** What opening version `i` restores besides its scenes: its script and, when it kept them, its vlog-wide settings. */
function restoreVersion(p: Project, index: number): Partial<Project> {
  const i = Math.max(0, Math.min(p.edits.length - 1, index))
  const { script, globals: g } = p.edits[i] ?? {}
  return {
    currentEdit: i,
    ...(script && { script }),
    ...(g && restoreGlobals(p, g)),
  }
}

export const undo = () => state().updateProject((p) => restoreVersion(p, p.currentEdit - 1))
export const redo = () => state().updateProject((p) => restoreVersion(p, p.currentEdit + 1))

/** Opens any saved version (the version menu). */
export const openVersion = (index: number) => state().updateProject((p) => restoreVersion(p, index))

/** A copy of a scene's footage right after it, as its own scene (no line, so nothing is said twice). */
export async function duplicateScene(index: number) {
  const { plan } = requireEdit()
  const copy: Scene = { id: uid('sc_'), shots: plan.scenes[index].shots.map((s, i) => ({ ...s, id: uid('s_'), transitionIn: i === 0 ? 'cut' : s.transitionIn })) }
  await commit(withHandEdit({ ...plan, scenes: [...plan.scenes.slice(0, index + 1), copy, ...plan.scenes.slice(index + 1)] }, copy.id, 'footage'), 'Duplicated a scene')
}

/** A new footage-only scene after `index`, with a good moment nobody uses yet. Returns its index. */
export async function addScene(index: number): Promise<number> {
  const { plan } = requireEdit()
  const at = index + 1
  const draft: EditPlan = { ...plan, scenes: [...plan.scenes.slice(0, at), { id: uid('sc_'), shots: [] }, ...plan.scenes.slice(at)] }
  const shots = pickFootage('', state().clips, draft, at, 2.5)
  if (!shots.length) throw new Error('There’s no footage left to add. Add more clips first.')
  const scene: Scene = { ...draft.scenes[at], shots }
  await commit(withHandEdit({ ...plan, scenes: [...plan.scenes.slice(0, at), scene, ...plan.scenes.slice(at)] }, scene.id, 'footage'), 'Added a scene')
  return at
}

/** Sets the vlog's length and re-fits: footage-only scenes shrink or grow; spoken lines keep their time. */
export async function setTargetLength(sec: Exclude<TargetLength, 'auto'>) {
  const { plan } = requireEdit()
  await state().updateProject((p) => ({ settings: { ...p.settings, targetSec: sec } }))
  await commit(plan, `Length about ${sec}s`)
}

/** Changes one shot by hand; the scene remembers what kind of change it was (Ask AI asks before changing it again). */
const mapShot = (plan: EditPlan, sceneIndex: number, shotIndex: number, kind: HandEdit, fn: (s: Shot) => Shot | Shot[]): EditPlan =>
  withHandEdit(
    mapScenes(plan, (scenes) => scenes.map((s, i) => (i !== sceneIndex ? s : { ...s, shots: s.shots.flatMap((x, j) => (j === shotIndex ? fn(x) : [x])) }))),
    plan.scenes[sceneIndex].id,
    kind,
  )

/** The words of a line were changed by hand. */
const wordsEdited = (plan: EditPlan, lineId: string): EditPlan => {
  const scene = plan.scenes.find((s) => s.lineId === lineId)
  return scene ? withHandEdit(plan, scene.id, 'words') : plan
}

const clipDurations = () => new Map(state().clips.map((c) => [c.id, c.durationSec]))

/** Changes effects on one shot (transition, camera move, fit, volume). */
export async function updateShot(sceneIndex: number, shotIndex: number, patch: Partial<Shot>, note: string) {
  const { plan } = requireEdit()
  await commit(mapShot(plan, sceneIndex, shotIndex, 'volume' in patch ? 'sound' : 'effects', (s) => ({ ...s, ...patch })), note)
}

/** Volume changes while dragging are merged into one version per pause. */
export async function setShotVolume(sceneIndex: number, shotIndex: number, volume: number) {
  const id = requireEdit().plan.scenes[sceneIndex].shots[shotIndex].id
  await commitMerged(`volume:${id}`, (plan) => mapShot(plan, sceneIndex, shotIndex, 'sound', (s) => ({ ...s, volume })), 'Clip volume')
}

/** Speed or speed curve; the shot keeps its length in the vlog and uses more or less footage. */
export async function setShotSpeed(sceneIndex: number, shotIndex: number, speed: number, ramp: Shot['ramp'] = 'none') {
  const { plan } = requireEdit()
  await commit(
    mapShot(plan, sceneIndex, shotIndex, 'effects', (s) => {
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
    mapShot(plan, sceneIndex, shotIndex, 'footage', (s) => {
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
    mapShot(plan, sceneIndex, shotIndex, 'effects', (s) => {
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

/**
 * Freezes the end of a shot: its last stretch (up to 1 s) becomes a still of
 * the frame where it stops, so the scene keeps its length.
 */
export async function holdLastFrame(sceneIndex: number, shotIndex: number) {
  const { plan } = requireEdit()
  const shot = plan.scenes[sceneIndex].shots[shotIndex]
  if (!shot.hold && shotLength(shot) - MIN_SHOT - 0.05 < 0.2) throw new Error('This shot is too short to freeze its end. Trim it longer first.')
  await commit(
    mapShot(plan, sceneIndex, shotIndex, 'effects', (s) => {
      if (s.hold) return s
      const len = shotLength(s)
      // the moving part keeps at least the shortest shot length, or re-fitting would drop the freeze
      const holdLen = round(Math.min(1, len - MIN_SHOT - 0.05))
      const stop = round(sourceTime(s, len - holdLen))
      return [
        { ...s, out: stop, ramp: undefined },
        { ...s, id: uid('s_'), in: stop, out: stop, hold: holdLen, speed: undefined, ramp: undefined, motion: undefined, clipAudio: 'mute', transitionIn: 'cut' },
      ]
    }),
    'Held the last frame',
  )
}

/** Copies a shot into a new footage-only scene right after this scene. */
export async function duplicateShot(sceneIndex: number, shotIndex: number) {
  const { plan } = requireEdit()
  const copy = { ...plan.scenes[sceneIndex].shots[shotIndex], id: uid('s_'), transitionIn: 'cut' as const }
  const copyScene = uid('sc_')
  await commit(
    withHandEdit(
      mapScenes(plan, (scenes) => [...scenes.slice(0, sceneIndex + 1), { id: copyScene, shots: [copy] }, ...scenes.slice(sceneIndex + 1)]),
      copyScene,
      'footage',
    ),
    'Duplicated a shot',
  )
}

export async function deleteShot(sceneIndex: number, shotIndex: number) {
  const { plan } = requireEdit()
  if (plan.scenes[sceneIndex].shots.length <= 1) return deleteScene(sceneIndex)
  await commit(mapShot(plan, sceneIndex, shotIndex, 'footage', () => []), 'Removed a shot')
}

/**
 * Saves a change as a new version, except that changes with the same `key`
 * less than 600 ms apart (dragging a slider) share one version.
 */
let lastMerge: { key: string; at: number; version: number } | null = null
let mergeQueue: Promise<unknown> = Promise.resolve()
function commitMerged(key: string, change: (plan: EditPlan) => EditPlan, note: string): Promise<void> {
  // Queued: slider events arrive faster than saves, and each must see the last one's result.
  const run = mergeQueue.then(async () => {
    const { plan } = requireEdit()
    const now = Date.now()
    if (lastMerge && lastMerge.key === key && now - lastMerge.at < 600 && lastMerge.version === plan.version) {
      await state().replaceCurrentEdit(change(plan))
    } else {
      await commit(change(plan), note)
    }
    lastMerge = { key, at: now, version: currentEdit(state().project)!.version }
  })
  mergeQueue = run.catch(() => {})
  return run
}

/** Look changes: `live` (slider drags) are merged into one version per pause. */
export async function setLook(patch: Partial<Look>, live = false) {
  const withPatch = (plan: EditPlan) => ({ ...plan, look: { ...(plan.look ?? DEFAULT_LOOK), ...patch } })
  if (live) await commitMerged(`look:${Object.keys(patch).join(',')}`, withPatch, 'Adjusted the look')
  else await commit(withPatch(requireEdit().plan), 'Changed the look')
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

/** Drops a scene's line: its footage stays, with no voice or caption. */
export async function removeLine(lineId: string) {
  const { project, plan } = requireEdit()
  if (project.script) await setScriptLines(project, project.script.lines.filter((l) => l.id !== lineId))
  await commit(wordsEdited({ ...plan, scenes: plan.scenes.map((s) => (s.lineId === lineId ? { ...s, lineId: undefined } : s)) }, lineId), 'Removed a line')
}
