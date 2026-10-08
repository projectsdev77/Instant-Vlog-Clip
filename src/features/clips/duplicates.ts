import type { Clip } from '@/domain/types'
import { hamming } from '@/media/imageStats'

/** Marks clips that look like a near-copy of an earlier clip (burst takes, re-recordings). */
export function findDuplicates(clips: Clip[]): Map<string, string> {
  const result = new Map<string, string>()
  const withHashes = clips.filter((c) => c.signals?.hashes.length)
  for (let i = 0; i < withHashes.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = withHashes[j]
      const b = withHashes[i]
      if (result.has(a.id)) continue
      const durRatio = Math.min(a.durationSec, b.durationSec) / Math.max(a.durationSec, b.durationSec)
      if (durRatio < 0.6) continue
      const ha = a.signals!.hashes
      const hb = b.signals!.hashes
      const picks = [0.25, 0.5, 0.75]
      const close = picks.filter((p) => hamming(ha[Math.floor(p * ha.length)], hb[Math.floor(p * hb.length)]) <= 8).length
      if (close >= 2) {
        result.set(b.id, a.id)
        break
      }
    }
  }
  return result
}
