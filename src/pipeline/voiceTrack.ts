import { ai } from '@/ai'
import { uid } from '@/domain/ids'
import type { Project, VoiceTake, VoiceTrack } from '@/domain/types'
import { peaksOf } from '@/domain/voiceTrack'
import { deleteMedia, getMedia, putMedia } from '@/lib/mediaStore'
import { decodeAudioFile, encodeWav } from '@/media/audio'
import { useProject } from '@/store/projectStore'

const state = () => useProject.getState()

/**
 * Turns a recording (or an imported audio file) into a take: evens out the
 * loudness (no trimming, so the timing stays exactly as recorded) and stores
 * it as WAV, which every browser can decode.
 */
async function prepare(blob: Blob): Promise<{ wav: Blob; durationSec: number; peaks: number[] }> {
  const buf = await decodeAudioFile(blob, 48000)
  const data = buf.getChannelData(0)
  let peak = 0
  for (const v of data) peak = Math.max(peak, Math.abs(v))
  const gain = peak > 0 ? Math.min(4, 0.89 / peak) : 1 // about -1 dBFS
  const out = new OfflineAudioContext(1, Math.max(1, data.length), buf.sampleRate).createBuffer(1, Math.max(1, data.length), buf.sampleRate)
  const o = out.getChannelData(0)
  for (let i = 0; i < data.length; i++) o[i] = data[i] * gain
  return { wav: encodeWav(out), durationSec: out.duration, peaks: peaksOf(o, out.sampleRate) }
}

function setTrack(fn: (t: VoiceTrack) => VoiceTrack) {
  return state().updateProject((p: Project) => ({ voiceTrack: fn(p.voiceTrack ?? { takes: [] }) }))
}

/** Adds a recording to the voice track at timeline time `start`. */
export async function addTake(blob: Blob, start: number): Promise<VoiceTake> {
  const { wav, durationSec, peaks } = await prepare(blob)
  const mediaKey = uid('m_')
  await putMedia(mediaKey, wav)
  const take: VoiceTake = { id: uid('t_'), mediaKey, start, in: 0, out: durationSec, durationSec, volume: 1, createdAt: Date.now(), peaks, transcript: 'pending' }
  // The first take settles how the user records: read the script, or say their own thing.
  const hasLines = !!state().project?.script?.lines.some((l) => l.text.trim())
  await setTrack((t) => ({ ...t, follow: t.follow ?? (hasLines ? 'script' : 'own'), takes: [...t.takes, take] }))
  void transcribeTake(take.id)
  return take
}

export const updateTakes = (fn: (takes: VoiceTake[]) => VoiceTake[]) => setTrack((t) => ({ ...t, takes: fn(t.takes) }))

export const setFollow = (follow: 'script' | 'own') => setTrack((t) => ({ ...t, follow }))

export async function deleteTake(id: string) {
  const take = state().project?.voiceTrack?.takes.find((t) => t.id === id)
  await updateTakes((takes) => takes.filter((t) => t.id !== id))
  // Split takes share a recording; only remove the file when nothing uses it.
  if (take && !state().project?.voiceTrack?.takes.some((t) => t.mediaKey === take.mediaKey)) void deleteMedia(take.mediaKey)
}

const inFlight = new Map<string, Promise<void>>()

/** Speech-to-text for a take's recording, for captions of what was actually said. */
export function transcribeTake(id: string): Promise<void> {
  const existing = inFlight.get(id)
  if (existing) return existing
  const run = (async () => {
    const take = state().project?.voiceTrack?.takes.find((t) => t.id === id)
    if (!take) return
    const mark = (patch: Partial<VoiceTake>) => updateTakes((takes) => takes.map((t) => (t.mediaKey === take.mediaKey ? { ...t, ...patch } : t)))
    await mark({ transcript: 'pending' })
    try {
      const blob = await getMedia(take.mediaKey)
      if (!blob) throw new Error('Recording missing')
      const res = await ai.transcribe(blob, state().project?.settings.language ?? 'en')
      await mark({ words: res.words, transcript: 'done' })
    } catch (e) {
      console.warn('Transcribing a take failed', e)
      await mark({ transcript: 'failed' })
    } finally {
      inFlight.delete(id)
    }
  })()
  inFlight.set(id, run)
  return run
}

/** Makes sure every take has captions (failed ones are tried again). */
export async function transcribeAll(): Promise<void> {
  const takes = state().project?.voiceTrack?.takes ?? []
  const byRecording = new Map(takes.filter((t) => t.transcript !== 'done').map((t) => [t.mediaKey, t.id]))
  await Promise.all([...byRecording.values()].map((id) => transcribeTake(id)))
}
