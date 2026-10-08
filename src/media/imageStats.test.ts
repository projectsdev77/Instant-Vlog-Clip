import { describe, expect, it } from 'vitest'
import { dHash, frameDiff, hamming, sharpness, voiceActivityRatio } from './imageStats'

describe('imageStats', () => {
  it('sharpness is higher for edges than for flat images', () => {
    const w = 16
    const flat = new Float32Array(w * w).fill(0.5)
    const checker = new Float32Array(w * w).map((_, i) => ((i % w) + Math.floor(i / w)) % 2)
    expect(sharpness(checker, w, w)).toBeGreaterThan(sharpness(flat, w, w))
  })

  it('frameDiff and hashes detect identical frames', () => {
    const a = new Float32Array(72).map((_, i) => (i * 7) % 13 / 13)
    expect(frameDiff(a, a)).toBe(0)
    expect(hamming(dHash(a), dHash(a))).toBe(0)
    const b = a.map((v) => 1 - v)
    expect(hamming(dHash(a), dHash(b))).toBeGreaterThan(20)
  })

  it('voice activity ignores silence and finds loud sections', () => {
    expect(voiceActivityRatio(new Array(50).fill(0.001))).toBe(0)
    const talky = [...new Array(50).fill(0.005), ...new Array(50).fill(0.2)]
    expect(voiceActivityRatio(talky)).toBeCloseTo(0.5, 1)
  })
})
