import type { PlanResponse, PlanShotWire } from '@shared/contracts.ts'
import type { EditPlan, Shot } from '@/domain/types'

export function shotToWire(x: Shot): PlanShotWire {
  return {
    clipId: x.clipId,
    in: x.in,
    out: x.out,
    focusX: x.crop.focusX,
    focusY: x.crop.focusY,
    clipAudio: x.clipAudio,
    transitionIn: x.transitionIn,
    motion: x.motion ?? 'none',
    speed: x.speed ?? 1,
    ramp: x.ramp ?? 'none',
  }
}

export function planToWire(plan: Pick<EditPlan, 'note' | 'scenes'>): PlanResponse {
  return { note: plan.note ?? '', scenes: plan.scenes.map((s) => ({ lineId: s.lineId ?? '', shots: s.shots.map(shotToWire) })) }
}
