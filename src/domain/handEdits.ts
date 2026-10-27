import type { EditPlan, HandEdit } from './types'

/** Notes that the user changed this part of a scene by hand, so Ask AI asks before changing it again. */
export function withHandEdit(plan: EditPlan, sceneId: string, kind: HandEdit): EditPlan {
  const now = plan.handEdits?.[sceneId] ?? []
  return now.includes(kind) ? plan : { ...plan, handEdits: { ...plan.handEdits, [sceneId]: [...now, kind] } }
}

/** Hand edits kept to the scenes that still exist. */
export function handEditsIn(plan: EditPlan, edits: EditPlan['handEdits']): EditPlan['handEdits'] {
  const ids = new Set(plan.scenes.map((s) => s.id))
  const kept = Object.fromEntries(Object.entries(edits ?? {}).filter(([id, kinds]) => ids.has(id) && kinds.length))
  return Object.keys(kept).length ? kept : undefined
}
