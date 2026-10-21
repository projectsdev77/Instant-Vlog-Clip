import { rankedMoments } from './moments'
import { usableClips } from './planContext'
import { fitShots, maxShotFor, shotFromMoment, sumShots } from './shots'
import type { Clip, EditPlan, Shot } from './types'

const STOP = new Set(['the', 'and', 'then', 'this', 'that', 'with', 'for', 'was', 'were', 'are', 'just', 'our', 'you', 'its', 'it’s', 'had', 'have', 'from', 'into', 'out', 'all', 'some', 'what', 'when', 'here', 'there', 'they', 'them', 'very', 'really', 'got'])

/** Content words of a text, lowercased, plural "s" dropped. */
function keywords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9’']{3,}/g) ?? []).filter((w) => !STOP.has(w)).map((w) => w.replace(/s$/, '')))
}

/**
 * Footage for one scene of exactly `sec` seconds that suits `text`: moments
 * whose clip the AI described with the same words rank first, then the
 * best-looking ones; footage used elsewhere in the vlog, or by the scenes
 * either side, is avoided. Works on device, so it's instant.
 */
export function pickFootage(text: string, clips: Clip[], plan: EditPlan, sceneIndex: number, sec: number): Shot[] {
  const want = [...keywords(text)]
  const used = plan.scenes.flatMap((s, i) => (i === sceneIndex ? [] : s.shots))
  const neighbours = new Set([sceneIndex - 1, sceneIndex + 1].flatMap((i) => plan.scenes[i]?.shots.map((s) => s.clipId) ?? []))
  const candidates = usableClips(clips)
    .flatMap((clip) => {
      const about = keywords(`${clip.analysis?.description ?? ''} ${(clip.analysis?.tags ?? []).join(' ')}`)
      return rankedMoments(clip).map((m) => {
        const why = keywords(m.why)
        const match = want.length ? want.filter((w) => about.has(w) || why.has(w)).length / want.length : 0
        const reused = used.some((u) => u.clipId === clip.id && m.start < u.out && m.end > u.in)
        return { clip, m, rank: m.score + 2 * match - (reused ? 1 : 0) - (neighbours.has(clip.id) ? 0.3 : 0) }
      })
    })
    .sort((a, b) => b.rank - a.rank)

  const shots: Shot[] = []
  for (const { clip, m } of candidates) {
    const need = sec - sumShots(shots)
    if (need < 0.05) break
    if (shots.some((s) => s.clipId === clip.id)) continue
    shots.push(shotFromMoment(clip, m, Math.min(need, maxShotFor(clip)), { clipAudio: 'duck' }))
  }
  return fitShots(shots, sec, new Map(clips.map((c) => [c.id, c]))).shots
}
