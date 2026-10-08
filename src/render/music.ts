import type { MusicTrack } from './musicTracks'

/**
 * Renders a placeholder background track in the browser: a looping chord
 * progression with a simple beat. Good enough to build and test the edit;
 * swap for licensed audio files via MusicTrack.url.
 */
const cache = new Map<string, Promise<AudioBuffer>>()

export function renderTrack(track: MusicTrack, durationSec: number, sampleRate = 48000): Promise<AudioBuffer> {
  const len = Math.ceil(durationSec + 1)
  const key = `${track.id}:${len}:${sampleRate}`
  let p = cache.get(key)
  if (!p) {
    p = track.url ? loadTrack(track.url, sampleRate) : synthesize(track, len, sampleRate)
    cache.set(key, p)
  }
  return p
}

async function loadTrack(url: string, sampleRate: number): Promise<AudioBuffer> {
  const data = await (await fetch(url)).arrayBuffer()
  return new OfflineAudioContext(2, 1, sampleRate).decodeAudioData(data)
}

const hz = (semitonesFromA3: number) => 220 * 2 ** (semitonesFromA3 / 12)

async function synthesize(track: MusicTrack, durationSec: number, sampleRate: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate)
  const master = ctx.createGain()
  master.gain.value = 0.5
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = track.style === 'pad' ? 1800 : 3200
  lp.connect(master).connect(ctx.destination)

  const beat = 60 / track.bpm
  const bar = beat * 4
  const third = track.mode === 'major' ? 4 : 3
  const bars = Math.ceil(durationSec / bar)

  const note = (freq: number, start: number, dur: number, type: OscillatorType, gain: number, attack: number) => {
    if (start >= durationSec) return
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, start)
    g.gain.linearRampToValueAtTime(gain, start + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(g).connect(lp)
    osc.start(start)
    osc.stop(start + dur + 0.05)
  }

  for (let b = 0; b < bars; b++) {
    const root = track.progression[b % track.progression.length]
    const chord = [root, root + third, root + 7].map(hz)
    const t0 = b * bar
    // bass
    note(hz(root - 12), t0, bar * 0.95, 'sine', 0.22, 0.02)
    if (track.style === 'pad') {
      chord.forEach((f) => {
        note(f, t0, bar * 1.05, 'sawtooth', 0.035, bar * 0.3)
        note(f * 1.004, t0, bar * 1.05, 'sawtooth', 0.03, bar * 0.3)
      })
    } else if (track.style === 'pluck') {
      for (let s = 0; s < 8; s++) note(chord[s % 3] * (s >= 4 ? 2 : 1), t0 + s * (beat / 2), beat * 0.9, 'triangle', 0.09, 0.005)
    } else {
      for (let s = 0; s < 8; s++) chord.forEach((f) => note(f, t0 + s * (beat / 2), beat * 0.35, 'square', 0.025, 0.005))
    }
    // drums: soft kick on every beat, hat off-beats (not for pads)
    for (let k = 0; k < 4; k++) {
      const kt = t0 + k * beat
      if (kt >= durationSec) break
      const kick = ctx.createOscillator()
      const kg = ctx.createGain()
      kick.frequency.setValueAtTime(120, kt)
      kick.frequency.exponentialRampToValueAtTime(45, kt + 0.12)
      kg.gain.setValueAtTime(track.style === 'pad' ? 0.18 : 0.32, kt)
      kg.gain.exponentialRampToValueAtTime(0.0001, kt + 0.25)
      kick.connect(kg).connect(master)
      kick.start(kt)
      kick.stop(kt + 0.3)
      if (track.style !== 'pad') hat(ctx, master, kt + beat / 2)
    }
  }
  return await ctx.startRendering()
}

let noise: AudioBuffer | null = null
function hat(ctx: OfflineAudioContext, out: AudioNode, t: number) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.05), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = noise
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.06, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  src.connect(hp).connect(g).connect(out)
  src.start(t)
}
