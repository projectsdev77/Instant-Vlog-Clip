import { AudioBufferSink } from 'mediabunny'
import { openInput } from './input'

/** Decodes a clip's audio (or a recording) to a mono AudioBuffer at `sampleRate`. */
export async function decodeAudio(blob: Blob, sampleRate = 48000, range?: [number, number]): Promise<AudioBuffer | null> {
  const input = openInput(blob)
  try {
    const track = await input.getPrimaryAudioTrack()
    if (!track || !(await track.canDecode())) return null
    const sink = new AudioBufferSink(track)
    const chunks: { data: Float32Array; ts: number; rate: number }[] = []
    for await (const { buffer, timestamp } of sink.buffers(range?.[0], range?.[1])) {
      const mono = new Float32Array(buffer.length)
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const d = buffer.getChannelData(c)
        for (let i = 0; i < d.length; i++) mono[i] += d[i] / buffer.numberOfChannels
      }
      chunks.push({ data: mono, ts: timestamp, rate: buffer.sampleRate })
    }
    if (!chunks.length) return null
    const srcRate = chunks[0].rate
    const start = range?.[0] ?? chunks[0].ts
    const end = chunks[chunks.length - 1].ts + chunks[chunks.length - 1].data.length / srcRate
    const length = Math.max(1, Math.ceil((Math.min(end, range?.[1] ?? end) - start) * srcRate))
    const raw = new Float32Array(length)
    for (const ch of chunks) {
      const offset = Math.round((ch.ts - start) * srcRate)
      for (let i = 0; i < ch.data.length; i++) {
        const j = offset + i
        if (j >= 0 && j < length) raw[j] = ch.data[i]
      }
    }
    return await resample(raw, srcRate, sampleRate)
  } finally {
    input.dispose()
  }
}

async function resample(data: Float32Array, from: number, to: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil((data.length * to) / from)), to)
  const src = ctx.createBuffer(1, data.length, from)
  src.copyToChannel(data as Float32Array<ArrayBuffer>, 0)
  const node = ctx.createBufferSource()
  node.buffer = src
  node.connect(ctx.destination)
  node.start()
  return await ctx.startRendering()
}

/** 16-bit PCM mono WAV, the format speech-to-text services accept everywhere. */
export function encodeWav(buffer: AudioBuffer): Blob {
  const data = buffer.getChannelData(0)
  const rate = buffer.sampleRate
  const out = new DataView(new ArrayBuffer(44 + data.length * 2))
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  out.setUint32(4, 36 + data.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, 1, true)
  out.setUint32(24, rate, true)
  out.setUint32(28, rate * 2, true)
  out.setUint16(32, 2, true)
  out.setUint16(34, 16, true)
  str(36, 'data')
  out.setUint32(40, data.length * 2, true)
  for (let i = 0; i < data.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true)
  return new Blob([out.buffer], { type: 'audio/wav' })
}

/** Decodes any browser-supported audio (recordings, TTS mp3) via Web Audio. */
export async function decodeAudioFile(blob: Blob, sampleRate = 48000): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 1, sampleRate)
  return await ctx.decodeAudioData(await blob.arrayBuffer())
}
