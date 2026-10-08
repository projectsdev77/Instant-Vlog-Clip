/** Pure pixel math used for on-device clip signals. Works on RGBA arrays. */

export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h)
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) / 255
  return g
}

export function meanBrightness(gray: Float32Array): number {
  let s = 0
  for (let i = 0; i < gray.length; i++) s += gray[i]
  return gray.length ? s / gray.length : 0
}

/** Variance of the Laplacian: a standard focus/blur measure. */
export function sharpness(gray: Float32Array, w: number, h: number): number {
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i]
      sum += lap
      sumSq += lap * lap
      n++
    }
  }
  if (!n) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}

/** Mean absolute difference between two frames, 0..1. */
export function frameDiff(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || !a.length) return 0
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

/** 64-bit difference hash as 16 hex chars. Input: 9x8 grayscale. */
export function dHash(gray9x8: Float32Array): string {
  let bits = ''
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gray9x8[y * 9 + x] < gray9x8[y * 9 + x + 1] ? '1' : '0'
  let hex = ''
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

export function hamming(a: string, b: string): number {
  let d = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      d += x & 1
      x >>= 1
    }
  }
  return d + Math.abs(a.length - b.length) * 4
}

/** Share of 100 ms windows whose loudness is clearly above the clip's noise floor. */
export function voiceActivityRatio(rms: number[]): number {
  if (!rms.length) return 0
  const sorted = [...rms].sort((a, b) => a - b)
  const floor = sorted[Math.floor(sorted.length * 0.1)]
  const peak = sorted[Math.floor(sorted.length * 0.95)]
  if (peak < 0.01) return 0 // silence
  const threshold = floor + (peak - floor) * 0.35
  return rms.filter((v) => v > threshold && v > 0.01).length / rms.length
}
