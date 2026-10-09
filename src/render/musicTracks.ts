import type { Vibe } from '@/domain/types'

/**
 * Music library. These are placeholder tracks generated in the browser so the
 * app works with no licensed files; replace with a licensed library (§6.1 of
 * the spec) by giving tracks a `url`.
 */
export type MusicTrack = {
  id: string
  name: string
  description: string
  vibes: Vibe[]
  bpm: number
  /** chord roots in semitones from A3 (220 Hz), one per bar */
  progression: number[]
  /** 'minor' or 'major' triads */
  mode: 'major' | 'minor'
  style: 'pluck' | 'pad' | 'pulse'
  url?: string
}

export const TRACKS: MusicTrack[] = [
  { id: 'sunny-day', name: 'Sunny Day', description: 'Upbeat acoustic', vibes: ['upbeat', 'funny', 'auto'], bpm: 116, progression: [3, 10, 0, 8], mode: 'major', style: 'pluck' },
  { id: 'lofi-walk', name: 'Lo-fi Walk', description: 'Chill beats', vibes: ['chill', 'aesthetic', 'auto'], bpm: 84, progression: [0, 5, 8, 3], mode: 'major', style: 'pad' },
  { id: 'golden-hour', name: 'Golden Hour', description: 'Warm synths', vibes: ['chill', 'cinematic', 'auto'], bpm: 96, progression: [8, 3, 10, 5], mode: 'major', style: 'pluck' },
  { id: 'city-pop', name: 'City Pop', description: 'Bright and bouncy', vibes: ['upbeat', 'funny'], bpm: 124, progression: [5, 0, 7, 3], mode: 'major', style: 'pulse' },
  { id: 'soft-piano', name: 'Soft Piano', description: 'Gentle, cinematic', vibes: ['cinematic', 'aesthetic'], bpm: 92, progression: [0, 8, 3, 10], mode: 'minor', style: 'pad' },
]

export function trackById(id: string | null | undefined): MusicTrack | undefined {
  return TRACKS.find((t) => t.id === id)
}

export function pickTrack(vibe: Vibe, seed = 0): MusicTrack {
  const matches = TRACKS.filter((t) => t.vibes.includes(vibe))
  const pool = matches.length ? matches : TRACKS
  return pool[seed % pool.length]
}
