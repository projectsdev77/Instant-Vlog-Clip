import { ALL_FORMATS, BlobSource, Input } from 'mediabunny'

export function openInput(blob: Blob): Input {
  return new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
}

export type ProbeResult = {
  durationSec: number
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
  hasAudio: boolean
  recordedAt?: string
}

export class UnsupportedVideoError extends Error {}

/** Reads basic facts about a video file without decoding it. */
export async function probeVideo(blob: Blob): Promise<ProbeResult> {
  const input = openInput(blob)
  try {
    const video = await input.getPrimaryVideoTrack()
    if (!video) throw new UnsupportedVideoError('No video track found in this file')
    if (!(await video.canDecode())) {
      const codec = await video.getCodec()
      throw new UnsupportedVideoError(`This browser can't decode ${codec ? codec.toUpperCase() + ' ' : ''}video. Try the latest Chrome or Safari.`)
    }
    const audio = await input.getPrimaryAudioTrack()
    const hasAudio = !!audio && (await audio.canDecode())
    const durationSec = await input.computeDuration()
    const tags = await input.getMetadataTags().catch(() => ({}) as { date?: Date })
    return {
      durationSec,
      width: await video.getDisplayWidth(),
      height: await video.getDisplayHeight(),
      rotation: (await video.getRotation()) as ProbeResult['rotation'],
      hasAudio,
      recordedAt: tags.date && !isNaN(tags.date.getTime()) ? tags.date.toISOString() : undefined,
    }
  } finally {
    input.dispose()
  }
}
