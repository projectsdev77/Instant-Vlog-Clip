import {
  AudioBufferSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  type Input,
  type WrappedCanvas,
} from 'mediabunny'
import type { Clip, Project } from '@/domain/types'
import type { Timeline, TimelineShot } from '@/domain/timeline'
import { TRANSITION_SEC } from '@/domain/timeline'
import { getMedia } from '@/lib/mediaStore'
import { openInput } from '@/media/input'
import { drawFrame, type FrameSource } from './compositor'
import { renderMix } from './mix'
import { outputSize, styleById } from './styles'

export const FPS = 30

export type ExportResult = { blob: Blob; mime: string; extension: 'mp4' | 'webm'; width: number; height: number }

export class ExportCancelled extends Error {}

/** Picks MP4/H.264/AAC when the browser can encode it, else WebM/VP9/Opus. */
async function pickFormat(width: number, height: number) {
  const video = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height })
  if (!video) throw new Error("This browser can't encode video. Try the latest Chrome or Safari.")
  if (video === 'avc') {
    const audio = await getFirstEncodableAudioCodec(['aac', 'opus'])
    if (audio === 'aac') return { video, audio, format: new Mp4OutputFormat({ fastStart: 'in-memory' }), mime: 'video/mp4', extension: 'mp4' as const }
  }
  const audio = await getFirstEncodableAudioCodec(['opus', 'vorbis'])
  if (!audio) throw new Error("This browser can't encode audio for video export.")
  const v = video === 'avc' ? ((await getFirstEncodableVideoCodec(['vp9', 'av1'], { width, height })) ?? 'vp9') : video
  return { video: v, audio, format: new WebMOutputFormat(), mime: 'video/webm', extension: 'webm' as const }
}

type Source = { input: Input; sink: CanvasSink }

/** Decoding size: enough to cover the output, never larger than the source. */
function sinkSize(clip: Clip, W: number, H: number) {
  const scale = Math.min(1, Math.max(W / clip.width, H / clip.height))
  return { width: Math.max(2, Math.round((clip.width * scale) / 2) * 2), height: Math.max(2, Math.round((clip.height * scale) / 2) * 2), fit: 'fill' as const }
}

/**
 * Renders the edit to a video file on this device: every frame is decoded at
 * its exact timestamp, composited like the preview, and encoded with WebCodecs.
 */
export async function exportVideo(tl: Timeline, project: Project, onProgress: (f: number) => void, signal?: AbortSignal): Promise<ExportResult> {
  const { width, height } = outputSize(project.settings.aspect, 1920)
  const fmt = await pickFormat(width, height)
  const style = styleById(project.styleId)

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  const target = new BufferTarget()
  const output = new Output({ format: fmt.format, target })
  const videoSource = new CanvasSource(canvas, { codec: fmt.video, bitrate: QUALITY_HIGH, keyFrameInterval: 2 })
  const audioSource = new AudioBufferSource({ codec: fmt.audio, bitrate: QUALITY_HIGH })
  output.addVideoTrack(videoSource, { frameRate: FPS })
  output.addAudioTrack(audioSource)

  const sources = new Map<string, Source>()
  const getSource = async (clip: Clip): Promise<Source> => {
    let s = sources.get(clip.id)
    if (!s) {
      const blob = await getMedia(clip.mediaKey)
      if (!blob) throw new Error(`The video "${clip.fileName}" is missing from this device.`)
      const input = openInput(blob)
      const track = await input.getPrimaryVideoTrack()
      if (!track) throw new Error(`Couldn't read "${clip.fileName}".`)
      s = { input, sink: new CanvasSink(track, sinkSize(clip, width, height)) }
      sources.set(clip.id, s)
    }
    return s
  }

  const check = () => {
    if (signal?.aborted) throw new ExportCancelled('Export cancelled')
  }

  try {
    await output.start()
    onProgress(0.01)
    const mix = await renderMix(tl, project)
    check()
    await audioSource.add(mix)
    audioSource.close()
    onProgress(0.05)

    const total = Math.max(1, Math.round(tl.duration * FPS))
    let shotIdx = -1
    let iter: AsyncGenerator<WrappedCanvas | null> | null = null
    let lastMain: FrameSource | null = null
    for (let i = 0; i < total; i++) {
      check()
      const t = i / FPS
      // advance to the shot covering t
      while (shotIdx + 1 < tl.shots.length && tl.shots[shotIdx + 1].start <= t + 1e-6) {
        shotIdx++
        const ts = tl.shots[shotIdx]
        const { sink } = await getSource(ts.clip)
        const first = Math.ceil((ts.start - 1e-6) * FPS)
        const last = Math.ceil((ts.end - 1e-6) * FPS) - 1
        const times: number[] = []
        for (let f = first; f <= last; f++) times.push(Math.min(ts.clip.durationSec - 0.02, ts.shot.in + (f / FPS - ts.start)))
        await iter?.return(undefined)
        iter = sink.canvasesAtTimestamps(times)
      }
      const cur = tl.shots[shotIdx]
      const next = iter ? await iter.next() : null
      const main: FrameSource | null = next && !next.done && next.value ? next.value.canvas : lastMain
      lastMain = main

      let prevFrame: FrameSource | null = null
      const local = t - cur.start
      if (cur.prev && cur.shot.transitionIn !== 'cut' && local < TRANSITION_SEC) {
        const { sink } = await getSource(cur.prev.clip)
        prevFrame = (await sink.getCanvas(Math.min(cur.prev.clip.durationSec - 0.02, cur.prev.shot.out + local)))?.canvas ?? null
      }
      drawFrame(ctx, width, height, t, tl, (s: TimelineShot) => (s === cur ? main : s === cur.prev ? prevFrame : null), style)
      await videoSource.add(t, 1 / FPS)
      if (i % 5 === 0) onProgress(0.05 + 0.93 * (i / total))
    }
    await iter?.return(undefined)
    videoSource.close()
    await output.finalize()
    onProgress(1)
    return { blob: new Blob([target.buffer!], { type: fmt.mime }), mime: fmt.mime, extension: fmt.extension, width, height }
  } catch (e) {
    await output.cancel().catch(() => {})
    throw e
  } finally {
    for (const s of sources.values()) s.input.dispose()
  }
}
