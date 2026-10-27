// "Ask AI" on the Edit page. The AI answers with exact changes (speed of
// scene 2, black and white, rewrite the intro...), which are applied here
// with the same tools as the panels, so nothing the user didn't ask about
// moves. All of them together become one version: one Undo takes them back.
import type { EditOpWire, EditRequest, EditResponse, EditStateWire } from '@shared/contracts.ts'
import { ai } from '@/ai'
import { buildCatalog } from '@/ai/catalog'
import { useVoices } from '@/ai/voices'
import { shotLength, speedOf, sumShots } from '@/domain/shots'
import { TEMPLATES } from '@/domain/templates'
import { DEFAULT_LOOK, FILTERS, OWN_MUSIC, type Delivery, type EditGlobals, type EditPlan, type Clip, type Look, type Moment, type Motion, type Project, type Shot, type TemplateId, type Transition, TRANSITIONS } from '@/domain/types'
import { TRACKS } from '@/render/musicTracks'
import { STYLES } from '@/render/styles'
import { currentEdit, useProject } from '@/store/projectStore'
import {
  addLine,
  addScene,
  applyTemplate,
  changeVoice,
  deleteScene,
  duplicateScene,
  editLine,
  holdLastFrame,
  moveScene,
  removeLine,
  restoreGlobals,
  rereadLine,
  setFades,
  setLineMuted,
  setLook,
  setShotAudio,
  setShotSpeed,
  setTargetLength,
  setTitleShow,
  swapShot,
  updateShot,
} from './editActions'

const state = () => useProject.getState()

export type AskResult = { reply: string; changed: boolean }

const MOTIONS: Motion[] = ['none', 'zoomIn', 'zoomOut', 'panLeft', 'panRight', 'punch', 'shake']
const DELIVERIES: Delivery[] = ['natural', 'calm', 'energetic', 'slow']
const ADJUST = { brightness: [-1, 1], contrast: [-1, 1], saturation: [-1, 1], warmth: [-1, 1], vignette: [0, 1], grain: [0, 1] } as const
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** The vlog as the AI sees it: scenes in play order with refs s1, s2... and every setting it can change. */
export function editState(project: Project, plan: EditPlan): EditStateWire {
  const lines = new Map(project.script?.lines.map((l) => [l.id, l]))
  const look = plan.look ?? DEFAULT_LOOK
  const fades = plan.fades ?? { in: false, out: false }
  const show = plan.title.showUntilSec
  const locked = new Set(plan.userScenes)
  return {
    title: project.title,
    titleShow: show === 0 ? 'off' : show === 'always' ? 'always' : 'start',
    captions: project.styleId,
    music: project.musicTrackId ?? 'none',
    musicLevelDb: project.musicGainDb,
    voice: project.voice.voiceId,
    template: plan.templateId ?? project.settings.template ?? 'daily',
    lengthSec: Math.round(plan.scenes.reduce((a, s) => a + sumShots(s.shots), 0) * 10) / 10,
    targetSec: project.settings.targetSec,
    look: {
      filter: look.filter,
      brightness: look.brightness,
      contrast: look.contrast,
      saturation: look.saturation,
      warmth: look.warmth,
      vignette: look.vignette,
      grain: look.grain,
      letterbox: !!look.letterbox,
      fades: fades.in && fades.out ? 'both' : fades.in ? 'in' : fades.out ? 'out' : 'none',
    },
    scenes: plan.scenes.map((s, i) => {
      const line = s.lineId ? lines.get(s.lineId) : undefined
      return {
        ref: `s${i + 1}`,
        seconds: Math.round(sumShots(s.shots) * 10) / 10,
        line: line?.text ?? '',
        lineMuted: !!line?.muted,
        delivery: line?.delivery ?? 'natural',
        locked: locked.has(s.id),
        shots: s.shots.map((x) => ({
          clipId: x.clipId,
          in: x.in,
          out: x.out,
          seconds: Math.round(shotLength(x) * 10) / 10,
          speed: speedOf(x),
          ramp: x.ramp ?? 'none',
          motion: x.motion ?? 'none',
          transitionIn: x.transitionIn,
          clipAudio: x.clipAudio,
          volume: x.volume ?? 1,
          fit: x.fit ?? 'look',
          frozen: !!x.hold,
        })),
      }
    }),
  }
}

export function editRequest(project: Project, plan: EditPlan, request: string, history: EditRequest['history'] = []): EditRequest {
  const clips = state().clips
  return {
    request,
    history: history.slice(-3),
    language: project.settings.language,
    voiceMode: project.voice.mode,
    vlog: editState(project, plan),
    catalog: buildCatalog(clips),
    options: {
      voices: useVoices.getState().voices.map((v) => ({ id: v.id, name: v.name, description: `${v.description}, ${v.accent}` })),
      music: [...TRACKS.map((t) => ({ id: t.id, name: t.name, description: t.description })), ...(project.ownMusic ? [{ id: OWN_MUSIC, name: project.ownMusic.name, description: 'the user’s own song' }] : [])],
      templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name })),
      captions: STYLES.map((s) => ({ id: s.id, name: s.name, description: s.description })),
      filters: [...FILTERS],
    },
  }
}

const globalsOf = (p: Project): EditGlobals => ({ title: p.title, musicTrackId: p.musicTrackId, musicGainDb: p.musicGainDb, styleId: p.styleId, voice: p.voice, targetSec: p.settings.targetSec })

/** Everything Ask AI can change, to tell whether an answer changed anything. */
const fingerprint = (p: Project, e: EditPlan) => JSON.stringify([e.scenes, e.look, e.fades, e.title, e.templateId, p.script?.lines.map((l) => [l.text, l.muted, l.delivery, l.seed]), globalsOf(p)])

/** A change the AI asked for that can't be made; skipped, the others still apply. */
class Skip extends Error {}

/**
 * Applies one change. Scenes are found by the id they had when the request
 * was sent, so earlier changes (a move, a delete) don't shift later ones.
 */
async function applyOp(op: EditOpWire, refs: Map<string, string>, locked: Set<string>) {
  const project = state().project!
  const plan = currentEdit(project)!
  const sceneId = refs.get(op.scene.trim())
  const sceneIndex = () => {
    const i = currentEdit(state().project)!.scenes.findIndex((s) => s.id === sceneId)
    if (i < 0) throw new Skip(`no scene ${op.scene}`)
    if (locked.has(sceneId!)) throw new Skip(`scene ${op.scene} is locked`)
    return i
  }
  // Shot ops: one shot (1-based) or, with 0, every shot of the scene. Shots are found by id as they may split.
  const eachShot = async (fn: (scene: number, shot: number, s: Shot) => Promise<unknown>) => {
    const i = sceneIndex()
    const all = currentEdit(state().project)!.scenes[i].shots
    const ids = op.shot > 0 ? [all[op.shot - 1]?.id].filter(Boolean) : all.map((s) => s.id)
    if (!ids.length) throw new Skip(`no shot ${op.shot}`)
    for (const id of ids) {
      const si = sceneIndex()
      const shots = currentEdit(state().project)!.scenes[si].shots
      const j = shots.findIndex((s) => s.id === id)
      if (j >= 0) await fn(si, j, shots[j])
    }
  }
  const lineId = () => {
    const id = currentEdit(state().project)!.scenes[sceneIndex()].lineId
    if (!id) throw new Skip(`scene ${op.scene} has no line`)
    return id
  }
  const v = op.value.trim()
  const voiceMode = project.voice.mode

  switch (op.op) {
    case 'move-scene': {
      const to = clamp(Math.round(op.to) - 1, 0, plan.scenes.length - 1)
      return moveScene(sceneIndex(), to)
    }
    case 'delete-scene':
      return deleteScene(sceneIndex())
    case 'duplicate-scene':
      return duplicateScene(sceneIndex())
    case 'add-scene':
      return addScene(sceneIndex())
    case 'swap-footage': {
      const clip = state().clips.find((c) => c.id === v)
      if (!clip) throw new Skip(`no clip ${v}`)
      const at = clamp(op.amount || 0, 0, Math.max(0, clip.durationSec - 0.5))
      const known = clip.analysis?.moments.find((m) => at >= m.start - 0.5 && at < m.end)
      const moment: Moment = known ?? { start: at, end: clip.durationSec, score: 0.5, why: '', focus: { x: 0.5, y: 0.5 } }
      return eachShot((i, j) => swapShot(i, j, clip.id, moment))
    }
    case 'speed': {
      const ramp = ['montage', 'hero', 'bullet'].includes(v) ? (v as Shot['ramp']) : undefined
      const speed = ramp ? 1 : Number(v)
      if (!ramp && !(speed >= 0.25 && speed <= 4)) throw new Skip(`speed ${v}`)
      return eachShot((i, j) => setShotSpeed(i, j, speed, ramp ?? 'none'))
    }
    case 'camera':
      if (!MOTIONS.includes(v as Motion)) throw new Skip(`camera ${v}`)
      return eachShot((i, j) => updateShot(i, j, { motion: v === 'none' ? undefined : (v as Motion) }, 'Camera move'))
    case 'transition':
      if (!TRANSITIONS.includes(v as Transition)) throw new Skip(`transition ${v}`)
      // The very first shot of the vlog always starts on a cut.
      return eachShot((i, j) => (i === 0 && j === 0 ? Promise.resolve() : updateShot(i, j, { transitionIn: v as Transition }, 'Transition')))
    case 'clip-sound':
      if (!['mute', 'duck', 'full'].includes(v)) throw new Skip(`clip sound ${v}`)
      return eachShot((i, j) => setShotAudio(i, j, v as Shot['clipAudio']))
    case 'clip-volume':
      return eachShot((i, j) => updateShot(i, j, { volume: clamp(op.amount, 0, 2) }, 'Clip volume'))
    case 'frame':
      if (!['look', 'fill', 'blur'].includes(v)) throw new Skip(`frame ${v}`)
      return eachShot((i, j) => updateShot(i, j, { fit: v === 'look' ? undefined : (v as Shot['fit']) }, 'Frame'))
    case 'freeze-end':
      return eachShot((i, j, s) => (s.hold ? Promise.resolve() : holdLastFrame(i, j)))
    case 'rewrite-line': {
      if (voiceMode === 'recorded') throw new Skip('own recording')
      if (!v) throw new Skip('empty line')
      const i = sceneIndex()
      const id = currentEdit(state().project)!.scenes[i].lineId
      return id ? editLine(id, v) : addLine(i, v)
    }
    case 'add-line':
      if (voiceMode === 'recorded') throw new Skip('own recording')
      if (!v) throw new Skip('empty line')
      return addLine(sceneIndex(), v)
    case 'remove-line':
      if (voiceMode === 'recorded') throw new Skip('own recording')
      return removeLine(lineId())
    case 'reread-line':
      if (voiceMode !== 'ai' || !DELIVERIES.includes(v as Delivery)) throw new Skip(`read ${v}`)
      return rereadLine(lineId(), v as Delivery)
    case 'mute-line':
      if (voiceMode !== 'ai') throw new Skip('no AI voice')
      return setLineMuted(lineId(), v !== 'off')
    case 'voice':
      if (voiceMode !== 'ai' || !useVoices.getState().voices.some((x) => x.id === v)) throw new Skip(`voice ${v}`)
      if (v === project.voice.voiceId) return
      return changeVoice(v)
    case 'filter':
      if (!FILTERS.includes(v as Look['filter'])) throw new Skip(`filter ${v}`)
      return setLook({ filter: v as Look['filter'] })
    case 'adjust': {
      const range = ADJUST[v as keyof typeof ADJUST]
      if (!range) throw new Skip(`adjust ${v}`)
      return setLook({ [v]: Math.round(clamp(op.amount, range[0], range[1]) * 100) / 100 })
    }
    case 'letterbox':
      return setLook({ letterbox: v === 'on' })
    case 'fades':
      if (!['none', 'in', 'out', 'both'].includes(v)) throw new Skip(`fades ${v}`)
      return setFades({ in: v === 'in' || v === 'both', out: v === 'out' || v === 'both' })
    case 'template':
      if (!TEMPLATES.some((t) => t.id === v)) throw new Skip(`template ${v}`)
      return applyTemplate(v as TemplateId)
    case 'music':
      if (v !== 'none' && !TRACKS.some((t) => t.id === v) && !(v === OWN_MUSIC && project.ownMusic)) throw new Skip(`music ${v}`)
      return state().updateProject({ musicTrackId: v === 'none' ? null : v })
    case 'music-level':
      return state().updateProject({ musicGainDb: Math.round(clamp(op.amount, -30, -4)) })
    case 'captions':
      if (!STYLES.some((s) => s.id === v)) throw new Skip(`captions ${v}`)
      return state().updateProject({ styleId: v as Project['styleId'] })
    case 'title':
      if (!v) throw new Skip('empty title')
      await state().updateProject({ title: v.slice(0, 40) })
      // A new title should be seen.
      if (plan.title.showUntilSec === 0) await setTitleShow(3)
      return
    case 'title-show':
      if (!['off', 'start', 'always'].includes(v)) throw new Skip(`title ${v}`)
      return setTitleShow(v === 'off' ? 0 : v === 'always' ? 'always' : 3)
    case 'length': {
      const sec = ([15, 20, 30, 60] as const).reduce((a, b) => (Math.abs(b - op.amount) < Math.abs(a - op.amount) ? b : a))
      return setTargetLength(sec)
    }
    default:
      throw new Skip(`unknown ${String(op.op)}`)
  }
}

/** Keeps only the version before Ask AI and the newest one (each tool saves its own version). */
function collapse(startVersion: number) {
  return state().updateProject((p) => {
    const i = p.edits.findIndex((e) => e.version === startVersion)
    if (i < 0 || p.currentEdit <= i) return {}
    const edits = [...p.edits.slice(0, i + 1), { ...p.edits[p.currentEdit], version: startVersion + 1 }]
    return { edits, currentEdit: edits.length - 1 }
  })
}

/** Sends the request, applies the answer and returns the AI's reply. */
export async function askAi(request: string, history: EditRequest['history'] = []): Promise<AskResult> {
  const project = state().project
  const plan = currentEdit(project)
  if (!project || !plan) throw new Error('No edit to change')
  const answer: EditResponse = await ai.editRequest(editRequest(project, plan, request, history))
  const ops = (Array.isArray(answer.ops) ? answer.ops : []).slice(0, 30)
  const reply = typeof answer.reply === 'string' && answer.reply.trim() ? answer.reply.trim() : ''
  if (!ops.length) return { reply: reply || 'I couldn’t tell what to change. Try saying which scene, or what should look or sound different.', changed: false }

  const before = { script: project.script, globals: globalsOf(project), userScenes: plan.userScenes }
  const refs = new Map(plan.scenes.map((s, i) => [`s${i + 1}`, s.id]))
  const locked = new Set(plan.userScenes)
  const startVersion = plan.version
  // A working copy, so tools that change the current version in place never touch the one before.
  await state().pushEdit({ ...plan, createdBy: 'ai', createdAt: Date.now() })

  let applied = 0
  let failure: string | undefined
  for (const op of ops) {
    try {
      await applyOp(op, refs, locked)
      applied++
    } catch (e) {
      if (e instanceof Skip) console.warn('Ask AI skipped a change:', e.message, op)
      else failure ??= (e as Error).message
    }
    await collapse(startVersion)
  }

  const after = state().project!
  const result = currentEdit(after)!
  if (!applied || fingerprint(after, result) === fingerprint(project, plan)) {
    // Nothing changed: drop the working copy and put everything back as it was.
    await state().updateProject((p) => {
      const i = p.edits.findIndex((e) => e.version === startVersion)
      return { edits: p.edits.slice(0, i + 1), currentEdit: i, script: before.script, ...restoreGlobals(p, before.globals) }
    })
    return { reply: failure ? `That didn’t work: ${failure}` : 'Nothing needed to change for that. Try saying which scene, or what should look or sound different.', changed: false }
  }

  // One version for the whole answer. Scenes the AI changed stay open to later AI changes (only the user's own locks count),
  // and both versions keep the vlog-wide settings so Undo / Redo bring them back.
  const kept = new Set(result.scenes.map((s) => s.id))
  await state().updateProject((p) => {
    const i = p.edits.findIndex((e) => e.version === startVersion)
    const edits = [...p.edits]
    edits[i] = { ...edits[i], globals: before.globals }
    edits[p.currentEdit] = { ...edits[p.currentEdit], createdBy: 'ai', note: `“${request}”`, userScenes: before.userScenes?.filter((id) => kept.has(id)), globals: globalsOf(p), script: p.script }
    return { edits }
  })
  return { reply: failure ? `${reply} (Part of it didn’t work: ${failure})` : reply || 'Done.', changed: true }
}

/**
 * Suggestion chips made from the user's own footage ("Open with the beach",
 * "Slow down the coffee part"), so they always fit this vlog. No AI call.
 */
export function suggestionsFor(project: Project, plan: EditPlan, clips: Clip[]): string[] {
  const byId = new Map(clips.map((c) => [c.id, c]))
  const tag = (clipId?: string) => (clipId ? byId.get(clipId)?.analysis?.tags?.find((t) => t.length > 2 && t.length < 18) : undefined)
  const used = new Set(plan.scenes.flatMap((s) => s.shots.map((x) => x.clipId)))
  const best = (c: Clip) => Math.max(0, ...(c.analysis?.moments.map((m) => m.score) ?? []))
  const opening = tag(plan.scenes[0]?.shots[0]?.clipId)
  const out: string[] = []
  const star = clips.filter((c) => used.has(c.id) && tag(c.id) && tag(c.id) !== opening).sort((a, b) => best(b) - best(a))[0]
  if (star) out.push(`Open with the ${tag(star.id)}`)
  const broll = plan.scenes.map((s) => tag(s.shots[0]?.clipId)).find((t, i) => t && !plan.scenes[i].lineId && t !== tag(star?.id))
  if (broll) out.push(`Slow down the ${broll} part`)
  if (project.script?.lines.length && project.voice.mode !== 'recorded') out.push('Make the intro funnier')
  out.push('Make it punchier', 'Black and white')
  return [...new Set(out)].slice(0, 3)
}
