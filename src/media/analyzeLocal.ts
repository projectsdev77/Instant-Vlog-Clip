import { AudioBufferSink, CanvasSink } from 'mediabunny'
import type { LocalSignals } from '@/domain/types'
import { dHash, frameDiff, meanBrightness, sharpness, toGray, voiceActivityRatio } from './imageStats'
import { openInput } from './input'

const SIGNAL_W = 96
const MAX_SAMPLES = 48
const SHEET_FRAMES = 12
const SHEET_COLS = 4
const SHEET_CELL_W = 256

export type LocalAnalysis = {
  thumbnail: string
  signals: LocalSignals
  contactSheet: { dataUrl: string; times: number[] }
}

function sampleTimes(duration: number): number[] {
  const n = Math.max(2, Math.min(MAX_SAMPLES, Math.round(duration)))
  const step = duration / n
  return Array.from({ length: n }, (_, i) => Math.min(duration - 0.05, i * step + step / 2))
}

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

async function toDataUrl(canvas: OffscreenCanvas | HTMLCanvasElement, quality = 0.75): Promise<string> {
  if ('convertToBlob' in canvas) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    return await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
  }
  return canvas.toDataURL('image/jpeg', quality)
}

const ctx2d = (c: OffscreenCanvas | HTMLCanvasElement) =>
  c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/**
 * One decoding pass over a clip that produces: a thumbnail, cheap quality
 * signals per sampled frame, and a labelled contact sheet for the AI.
 */
export async function analyzeLocally(blob: Blob, durationSec: number, hasAudio: boolean): Promise<LocalAnalysis> {
  const input = openInput(blob)
  try {
    const track = (await input.getPrimaryVideoTrack())!
    const aspect = (await track.getDisplayHeight()) / (await track.getDisplayWidth())
    const times = sampleTimes(durationSec)
    const sheetEvery = Math.max(1, Math.floor(times.length / SHEET_FRAMES))
    const sheetIdx = times.map((_, i) => i).filter((i) => i % sheetEvery === 0).slice(0, SHEET_FRAMES)

    const cellH = Math.round(SHEET_CELL_W * aspect)
    const rows = Math.ceil(sheetIdx.length / SHEET_COLS)
    const sheet = makeCanvas(SHEET_CELL_W * SHEET_COLS, cellH * rows)
    const sctx = ctx2d(sheet)
    sctx.fillStyle = '#000'
    sctx.fillRect(0, 0, sheet.width, sheet.height)

    const sigH = Math.max(8, Math.round(SIGNAL_W * aspect))
    const small = makeCanvas(SIGNAL_W, sigH)
    const smallCtx = ctx2d(small)
    const hashCanvas = makeCanvas(9, 8)
    const hashCtx = ctx2d(hashCanvas)

    const sink = new CanvasSink(track, { width: SHEET_CELL_W, poolSize: 2 })
    const signals: LocalSignals = { sampleTimes: [], sharpness: [], brightness: [], motion: [], speechRatio: 0, hashes: [] }
    let prev: Float32Array | null = null
    let thumbnail = ''
    let i = 0
    for await (const frame of sink.canvasesAtTimestamps(times)) {
      const t = times[i]
      if (frame) {
        smallCtx.drawImage(frame.canvas, 0, 0, SIGNAL_W, sigH)
        const gray = toGray(smallCtx.getImageData(0, 0, SIGNAL_W, sigH).data, SIGNAL_W, sigH)
        hashCtx.drawImage(frame.canvas, 0, 0, 9, 8)
        const hashGray = toGray(hashCtx.getImageData(0, 0, 9, 8).data, 9, 8)
        signals.sampleTimes.push(t)
        signals.brightness.push(meanBrightness(gray))
        signals.sharpness.push(sharpness(gray, SIGNAL_W, sigH))
        signals.motion.push(prev ? frameDiff(prev, gray) : 0)
        signals.hashes.push(dHash(hashGray))
        prev = gray

        const cell = sheetIdx.indexOf(i)
        if (cell >= 0) {
          const x = (cell % SHEET_COLS) * SHEET_CELL_W
          const y = Math.floor(cell / SHEET_COLS) * cellH
          sctx.drawImage(frame.canvas, x, y, SHEET_CELL_W, cellH)
          const label = `${t.toFixed(1)}s`
          sctx.font = 'bold 18px sans-serif'
          sctx.fillStyle = 'rgba(0,0,0,0.65)'
          sctx.fillRect(x + 4, y + 4, sctx.measureText(label).width + 12, 26)
          sctx.fillStyle = '#fff'
          sctx.fillText(label, x + 10, y + 24)
        }
        if (!thumbnail && (t >= Math.min(1, durationSec * 0.2) || i === times.length - 1)) {
          const thumb = makeCanvas(SHEET_CELL_W, cellH)
          ctx2d(thumb).drawImage(frame.canvas, 0, 0, SHEET_CELL_W, cellH)
          thumbnail = await toDataUrl(thumb, 0.7)
        }
      }
      i++
    }

    if (hasAudio) signals.speechRatio = voiceActivityRatio(await loudnessWindows(input))

    return {
      thumbnail,
      signals,
      contactSheet: { dataUrl: await toDataUrl(sheet, 0.72), times: sheetIdx.map((k) => times[k]) },
    }
  } finally {
    input.dispose()
  }
}

/** RMS loudness per 100 ms window, mono. */
async function loudnessWindows(input: ReturnType<typeof openInput>): Promise<number[]> {
  const track = await input.getPrimaryAudioTrack()
  if (!track) return []
  const sink = new AudioBufferSink(track)
  const out: number[] = []
  let acc = 0
  let n = 0
  let windowSize = 0
  for await (const { buffer } of sink.buffers()) {
    windowSize ||= Math.round(buffer.sampleRate / 10)
    const ch = buffer.getChannelData(0)
    for (let i = 0; i < ch.length; i++) {
      acc += ch[i] * ch[i]
      if (++n === windowSize) {
        out.push(Math.sqrt(acc / n))
        acc = 0
        n = 0
      }
    }
  }
  return out
}
