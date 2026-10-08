import type { Project } from '@/domain/types'
import type { Timeline } from '@/domain/timeline'
import { getMedia } from '@/lib/mediaStore'
import { decodeAudio, decodeAudioFile } from '@/media/audio'
import { renderTrack } from './music'
import { trackById } from './musicTracks'

const SR = 48000
const dbToGain = (db: number) => 10 ** (db / 20)

const clipAudioCache = new Map<string, Promise<AudioBuffer | null>>()
const voiceCache = new Map<string, Promise<AudioBuffer | null>>()

function clipRange(mediaKey: string, a: number, b: number) {
  const key = `${mediaKey}:${a.toFixed(3)}:${b.toFixed(3)}`
  let p = clipAudioCache.get(key)
  if (!p) {
    p = getMedia(mediaKey).then((blob) => (blob ? decodeAudio(blob, SR, [a, b]) : null)).catch(() => null)
    clipAudioCache.set(key, p)
  }
  return p
}

function voiceBuffer(mediaKey: string) {
  let p = voiceCache.get(mediaKey)
  if (!p) {
    p = getMedia(mediaKey).then((blob) => (blob ? decodeAudioFile(blob, SR) : null)).catch(() => null)
    voiceCache.set(mediaKey, p)
  }
  return p
}

/**
 * Renders the vlog's full soundtrack: narration, clip sound and music, with the
 * music ducked under the voice. Used for both preview playback and export.
 */
export async function renderMix(tl: Timeline, project: Project): Promise<AudioBuffer> {
  const duration = Math.max(0.5, tl.duration)
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR)
  const ramp = 0.12

  // Narration
  const voiceGain = ctx.createGain()
  voiceGain.gain.value = dbToGain(project.voice.volumeDb)
  voiceGain.connect(ctx.destination)
  const voices = await Promise.all(tl.voice.map(async (v) => ({ v, buf: await voiceBuffer(v.mediaKey) })))
  for (const { v, buf } of voices) {
    if (!buf) continue
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(voiceGain)
    src.start(v.start)
  }

  // Clip sound
  const clipShots = tl.shots.filter((s) => s.shot.clipAudio !== 'mute' && s.clip.hasAudio)
  const clipBufs = await Promise.all(clipShots.map(async (s) => ({ s, buf: await clipRange(s.clip.mediaKey, s.shot.in, s.shot.out) })))
  for (const { s, buf } of clipBufs) {
    if (!buf) continue
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    const level = s.shot.clipAudio === 'full' ? 1 : 0.3
    const len = s.end - s.start
    const fade = Math.min(0.08, len / 4)
    g.gain.setValueAtTime(0, s.start)
    g.gain.linearRampToValueAtTime(level, s.start + fade)
    for (const [a, b] of tl.speech) {
      if (b < s.start || a > s.end || s.shot.clipAudio === 'full') continue
      g.gain.setValueAtTime(level, Math.max(s.start + fade, a - ramp))
      g.gain.linearRampToValueAtTime(level * 0.35, Math.max(s.start + fade, a))
      g.gain.setValueAtTime(level * 0.35, Math.min(s.end - fade, b))
      g.gain.linearRampToValueAtTime(level, Math.min(s.end - fade, b + ramp))
    }
    g.gain.setValueAtTime(level, Math.max(s.start + fade, s.end - fade))
    g.gain.linearRampToValueAtTime(0, s.end)
    src.connect(g).connect(ctx.destination)
    src.start(s.start, 0, len)
  }

  // Music, ducked under narration and under clips playing their own speech
  const track = trackById(project.musicTrackId)
  if (track) {
    const music = await renderTrack(track, duration, SR)
    const src = ctx.createBufferSource()
    src.buffer = music
    const g = ctx.createGain()
    const base = dbToGain(project.musicGainDb)
    const duck = base * 0.3
    const quiet: [number, number][] = [...tl.speech, ...tl.shots.filter((s) => s.shot.clipAudio === 'full').map((s) => [s.start, s.end] as [number, number])].sort((a, b) => a[0] - b[0])
    g.gain.setValueAtTime(0, 0)
    g.gain.linearRampToValueAtTime(base, 0.4)
    for (const [a, b] of quiet) {
      g.gain.setValueAtTime(base, Math.max(0.4, a - ramp * 2))
      g.gain.linearRampToValueAtTime(duck, Math.max(0.41, a))
      g.gain.setValueAtTime(duck, b)
      g.gain.linearRampToValueAtTime(base, b + ramp * 3)
    }
    const fadeStart = Math.max(0.5, duration - 1.5)
    const quietAtEnd = quiet.some(([a, b]) => fadeStart >= a && fadeStart <= b)
    g.gain.setValueAtTime(quietAtEnd ? duck : base, fadeStart)
    g.gain.linearRampToValueAtTime(0, duration)
    src.connect(g).connect(ctx.destination)
    src.start(0)
  }

  const out = await ctx.startRendering()
  limit(out)
  return out
}

/** Soft limiter so stacked sources never clip. */
function limit(buf: AudioBuffer) {
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const x = d[i]
      if (x > 0.9 || x < -0.9) d[i] = Math.tanh(x)
    }
  }
}
