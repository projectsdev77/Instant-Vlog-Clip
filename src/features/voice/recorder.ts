import { decodeAudioFile, encodeWav } from '@/media/audio'

export type Recording = { stop: () => Promise<Blob>; cancel: () => void; level: () => number }

/** Starts recording from the microphone. Resolves once recording has started. */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m))
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)

  const ctx = new AudioContext()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  ctx.createMediaStreamSource(stream).connect(analyser)
  const buf = new Float32Array(analyser.fftSize)

  const cleanup = () => {
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
  }
  rec.start()
  return {
    level: () => {
      analyser.getFloatTimeDomainData(buf)
      let s = 0
      for (const v of buf) s += v * v
      return Math.min(1, Math.sqrt(s / buf.length) * 4)
    },
    cancel: () => {
      rec.onstop = null
      if (rec.state !== 'inactive') rec.stop()
      cleanup()
    },
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          cleanup()
          resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
        }
        rec.stop()
      }),
  }
}

/**
 * Trims silence at both ends and evens out loudness, so each recorded line
 * sits nicely in the edit. Returns a WAV.
 */
export async function cleanUpRecording(blob: Blob): Promise<{ wav: Blob; durationSec: number }> {
  const buf = await decodeAudioFile(blob, 48000)
  const data = buf.getChannelData(0)
  const win = Math.round(buf.sampleRate * 0.02)
  const rms = (i: number) => {
    let s = 0
    for (let j = i; j < Math.min(data.length, i + win); j++) s += data[j] * data[j]
    return Math.sqrt(s / win)
  }
  let peak = 0
  for (const v of data) peak = Math.max(peak, Math.abs(v))
  const threshold = Math.max(0.01, peak * 0.08)
  let start = 0
  while (start < data.length && rms(start) < threshold) start += win
  let end = data.length
  while (end > start && rms(Math.max(0, end - win)) < threshold) end -= win
  const pad = Math.round(buf.sampleRate * 0.08)
  start = Math.max(0, start - pad)
  end = Math.min(data.length, end + pad)
  if (end - start < buf.sampleRate * 0.2) {
    start = 0
    end = data.length
  }
  const gain = peak > 0 ? Math.min(4, 0.89 / peak) : 1 // normalize to about -1 dBFS
  const out = new OfflineAudioContext(1, end - start, buf.sampleRate).createBuffer(1, end - start, buf.sampleRate)
  const o = out.getChannelData(0)
  const fade = Math.min(Math.round(buf.sampleRate * 0.01), Math.floor(o.length / 2))
  for (let i = 0; i < o.length; i++) {
    const env = Math.min(1, i / fade, (o.length - 1 - i) / fade)
    o[i] = data[start + i] * gain * env
  }
  return { wav: encodeWav(out), durationSec: out.duration }
}
