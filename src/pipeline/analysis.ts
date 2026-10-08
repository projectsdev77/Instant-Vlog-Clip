import { ai } from '@/ai'
import type { Clip } from '@/domain/types'
import { getMedia } from '@/lib/mediaStore'
import { decodeAudio, encodeWav } from '@/media/audio'
import { useProject } from '@/store/projectStore'
import { waitForImports } from '@/features/clips/importClips'

const inFlight = new Map<string, Promise<void>>()

const needsAnalysis = (c: Clip) => c.status === 'ready' && !!c.contactSheet && !c.analysis

/**
 * Sends each clip's contact sheet (and on-camera speech) to the AI. Runs in the
 * background as soon as clips are ready; generation awaits whatever is left.
 * Failures are non-fatal: the planner falls back to on-device signals.
 */
export async function analyzeClipsInBackground(opts: { waitForImports?: boolean } = {}): Promise<void> {
  if (opts.waitForImports) await waitForImports()
  const clips = useProject.getState().clips.filter(needsAnalysis)
  await Promise.all([runLimited(clips.map((c) => () => analyzeOne(c)), 3), ...inFlight.values()])
}

export function analyzeOne(clip: Clip): Promise<void> {
  const existing = inFlight.get(clip.id)
  if (existing) return existing
  const p = (async () => {
    const { updateClip } = useProject.getState()
    await updateClip(clip.id, { status: 'analyzing' })
    try {
      let transcript = clip.transcript
      if (!transcript && clip.hasAudio && (clip.signals?.speechRatio ?? 0) > 0.3) transcript = await transcribeClip(clip)
      const analysis = await ai.analyzeClip({
        clipId: clip.id,
        fileName: clip.fileName,
        durationSec: clip.durationSec,
        contactSheetBase64: clip.contactSheet!.dataUrl.split(',')[1] ?? '',
        frameTimes: clip.contactSheet!.times,
        transcript: transcript?.text || undefined,
        speechRatio: clip.signals?.speechRatio ?? 0,
      })
      await updateClip(clip.id, { analysis, transcript, status: 'analyzed' })
    } catch (e) {
      console.warn('Clip analysis failed; using on-device signals', e)
      await updateClip(clip.id, { status: 'ready' })
    } finally {
      inFlight.delete(clip.id)
    }
  })()
  inFlight.set(clip.id, p)
  return p
}

async function transcribeClip(clip: Clip) {
  const blob = await getMedia(clip.mediaKey)
  if (!blob) return undefined
  const audio = await decodeAudio(blob, 16000, [0, Math.min(clip.durationSec, 120)])
  if (!audio) return undefined
  const t = await ai.transcribe(encodeWav(audio), 'en')
  return t.text ? t : undefined
}

export async function runLimited(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  let i = 0
  const worker = async () => {
    while (i < tasks.length) await tasks[i++]()
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
}

export function analysisProgress(clips: Clip[]): { done: number; total: number } {
  const usable = clips.filter((c) => c.status !== 'error')
  return { done: usable.filter((c) => c.status === 'analyzed' || (c.status === 'ready' && !!c.analysis)).length, total: usable.length }
}
