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
