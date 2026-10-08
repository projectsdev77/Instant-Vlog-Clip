import type { AnalyzeClipResponse, CatalogEntry } from '@shared/contracts.ts'
import { rankedMoments } from '@/domain/moments'
import type { Clip, ClipAnalysis } from '@/domain/types'

export function analysisFromWire(r: AnalyzeClipResponse, durationSec: number): ClipAnalysis {
  return {
    description: r.description,
    tags: r.tags.map((t) => t.toLowerCase()),
    shotType: r.shotType,
    quality: r.quality,
    moments: r.moments
      .map((m) => ({
        start: Math.max(0, Math.min(m.start, durationSec)),
        end: Math.max(0, Math.min(m.end, durationSec)),
        score: Math.max(0, Math.min(1, m.score)),
        why: m.why,
        focus: { x: Math.max(0, Math.min(1, m.focusX)), y: Math.max(0, Math.min(1, m.focusY)) },
      }))
      .filter((m) => m.end - m.start > 0.2),
  }
}

/** Compact, text-only description of the footage for the script writer and planner. */
export function buildCatalog(clips: Clip[]): CatalogEntry[] {
  return [...clips]
    .filter((c) => c.status !== 'error' && c.durationSec > 0)
    .sort((a, b) => (a.recordedAt ?? '').localeCompare(b.recordedAt ?? '') || a.addedAt - b.addedAt)
    .map((c) => ({
      clipId: c.id,
      durationSec: Math.round(c.durationSec * 100) / 100,
      recordedAt: c.recordedAt,
      description: c.analysis?.description ?? `Clip "${c.fileName}"`,
      tags: c.analysis?.tags ?? [],
      shotType: c.analysis?.shotType ?? 'other',
      mustInclude: c.mustInclude,
      unusable: !!c.analysis?.quality.accidental || !!c.signals?.duplicateOf,
      moments: rankedMoments(c).map((m) => ({ start: round1(m.start), end: round1(m.end), score: round2(m.score), why: m.why })),
      transcript: c.transcript?.text || undefined,
    }))
}

const round1 = (v: number) => Math.round(v * 10) / 10
const round2 = (v: number) => Math.round(v * 100) / 100
