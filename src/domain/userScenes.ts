import type { EditPlan, Scene } from './types'

/**
 * Puts the scenes the user picked footage for back into a plan the AI just
 * made (Tell the AI, make again). A narrated scene keeps its shots under the
 * same line; a footage-only one goes back to its place: the same slot when
 * the scene layout is unchanged (own voice keeps its timing), else right
 * after the line it followed. A line that no longer exists drops its scene.
 */
export function keepUserScenes(current: EditPlan, next: EditPlan): EditPlan {
  const mine = new Set(current.userScenes ?? [])
  if (!mine.size) return next
  const sameSlots = next.scenes.length === current.scenes.length && next.scenes.every((s, i) => (s.lineId ?? '') === (current.scenes[i].lineId ?? ''))
  const scenes: Scene[] = [...next.scenes]
  const kept: string[] = []
  current.scenes.forEach((s, ci) => {
    if (!mine.has(s.id)) return
    if (sameSlots) {
      scenes[ci] = { ...scenes[ci], shots: s.shots }
      kept.push(scenes[ci].id)
      return
    }
    if (s.lineId) {
      const i = scenes.findIndex((x) => x.lineId === s.lineId)
      if (i < 0) return
      scenes[i] = { ...scenes[i], shots: s.shots }
      kept.push(scenes[i].id)
      return
    }
    const prevLine = current.scenes
      .slice(0, ci)
      .map((x) => x.lineId)
      .filter(Boolean)
      .pop()
    const at = (prevLine ? scenes.findIndex((x) => x.lineId === prevLine) : -1) + 1
    if (scenes[at] && !scenes[at].lineId && !kept.includes(scenes[at].id)) scenes[at] = s
    else scenes.splice(at, 0, s)
    kept.push(s.id)
  })
  return { ...next, scenes, userScenes: kept }
}

/** Marks a scene as one the user picked footage for. */
export const withUserScene = (plan: EditPlan, sceneId: string): EditPlan =>
  plan.userScenes?.includes(sceneId) ? plan : { ...plan, userScenes: [...(plan.userScenes ?? []), sceneId] }
