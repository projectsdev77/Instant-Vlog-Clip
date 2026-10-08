import type { CatalogEntry, PlanRequest, PlanResponse, ScriptRequest, ScriptResponse } from '@shared/contracts.ts'
import { planFallback } from '@/domain/fallback'
import { textHash } from '@/domain/ids'
import { DEFAULT_SETTINGS, type Clip, type ClipAnalysis, type Script, type ShotType, type Vibe, type Word } from '@/domain/types'
import { estimatedWords, LINE_LEAD_IN, LINE_TAIL } from '@/domain/timing'
import { encodeWav } from '@/media/audio'
import type { AiService } from './service'

/**
 * Demo AI: runs the whole app with no accounts or keys. Outputs are simple but
 * shaped exactly like the real thing, so every screen can be built and tested.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const latency = () => wait(250 + Math.random() * 500)

const tokens = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .split(/[^a-zA-Z]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 2 && !/^(img|vid|mov|mp4|dsc|pxl|again|copy|final)$/.test(t))

const SHOT_WORDS: Record<string, ShotType> = { selfie: 'talking_head', talking: 'talking_head', vlog: 'talking_head', closeup: 'closeup', close: 'closeup', wide: 'wide', pov: 'pov', pan: 'pan' }

function describe(fileName: string): { description: string; tags: string[] } {
  const t = tokens(fileName).filter((w) => !(w in SHOT_WORDS))
  if (!t.length) return { description: 'A moment from the day', tags: ['moment'] }
  return { description: `${t.join(' ').replace(/^./, (c) => c.toUpperCase())}`, tags: t }
}

function shortTitle(prompt: string): string {
  const words = prompt.split(/[.,!?]/)[0].trim().split(/\s+/).slice(0, 6)
  while (words.length > 1 && /^(the|a|an|in|on|at|of|and|with|to|for)$/i.test(words[words.length - 1])) words.pop()
  return cap(words.join(' '))
}

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())

function polishLine(line: string): string {
  let s = line.trim().replace(/\s+/g, ' ').replace(/^[-•*]\s*/, '')
  if (!s) return s
  s = cap(s)
  if (!/[.!?…]$/.test(s)) s += '.'
  return s
}

const CONNECTORS = ['Started with', 'Then', 'After that,', 'Next up:', 'Later,', 'And of course,']

function writeLines(req: ScriptRequest): ScriptResponse['lines'] {
  const usable = req.catalog.filter((c) => !c.unusable)
  const perLine = 3
  const budget = req.targetSec === 'auto' ? Math.min(usable.length, 6) : Math.max(1, Math.round(req.targetSec / perLine) - 2)
  const story = usable.slice(0, budget).map((c, i) => {
    const what = c.description.toLowerCase()
    return {
      text: c.shotType === 'talking_head' ? 'Quick update from me.' : `${CONNECTORS[i % CONNECTORS.length]} ${what}.`,
      purpose: 'story' as const,
      visualIntent: c.description,
      onScreenText: '',
    }
  })
  const about = req.prompt.trim().replace(/[.!]$/, '')
  return [
    { text: about ? `So here's ${about.charAt(0).toLowerCase()}${about.slice(1)}…` : "So here's how today went…", purpose: 'hook', visualIntent: usable[0]?.description ?? '', onScreenText: '' },
    ...story,
    { text: 'Honestly? Pretty great day.', purpose: 'outro', visualIntent: usable[usable.length - 1]?.description ?? '', onScreenText: '' },
  ]
}

function clipsFromCatalog(catalog: CatalogEntry[]): Clip[] {
  return catalog.map((c, i) => ({
    id: c.clipId,
    projectId: '',
    fileName: c.description,
    mime: '',
    sizeBytes: 0,
    mediaKey: '',
    durationSec: c.durationSec,
    width: 0,
    height: 0,
    rotation: 0,
    hasAudio: true,
    recordedAt: c.recordedAt,
    addedAt: i,
    mustInclude: c.mustInclude,
    status: 'analyzed',
    analysis: {
      description: c.description,
      tags: c.tags,
      shotType: c.shotType,
      quality: { shaky: false, blurry: false, dark: false, accidental: c.unusable },
      moments: c.moments.map((m) => ({ ...m, focus: { x: 0.5, y: 0.5 } })),
    } satisfies ClipAnalysis,
  }))
}

function vibeFromFeedback(feedback: string | undefined, vibe: string): Vibe {
  const f = feedback?.toLowerCase() ?? ''
  if (/(fast|punch|quick|energ|upbeat)/.test(f)) return 'upbeat'
  if (/(slow|calm|chill|relax)/.test(f)) return 'chill'
  return vibe as Vibe
}

function plan(req: PlanRequest): PlanResponse {
  const clips = clipsFromCatalog(req.catalog)
  const script: Script | undefined = req.lines.length
    ? {
        title: '',
        lines: req.lines.map((l) => {
          const speech = Math.max(0.5, l.sceneSec - LINE_LEAD_IN - LINE_TAIL)
          return { id: l.lineId, text: l.text, purpose: 'story', visualIntent: l.visualIntent, audio: { mediaKey: '', durationSec: speech, words: [], source: 'ai', textHash: textHash(l.text) } }
        }),
      }
    : undefined
  const vibe = vibeFromFeedback(req.feedback, req.vibe)
  const p = planFallback({
    clips,
    script,
    voiceMode: req.narrated ? 'ai' : 'none',
    settings: { ...DEFAULT_SETTINGS, aspect: req.aspect, vibe, targetSec: req.lines.length ? 'auto' : (req.targetSec as 15 | 30 | 60) },
    title: '',
    musicTrackId: null,
    musicGainDb: 0,
  })

  // "Start with the sunset" → put the best matching clip first.
  const m = req.feedback?.toLowerCase().match(/(?:start|open|begin)\s+(?:with|on)\s+(?:the\s+)?([a-z]+)/)
  if (m && p.scenes[0]) {
    const hit = clips.find((c) => `${c.analysis?.description} ${c.analysis?.tags.join(' ')}`.toLowerCase().includes(m[1]))
    const first = p.scenes[0].shots[0]
    if (hit && first.clipId !== hit.id) {
      const other = p.scenes.flatMap((sc) => sc.shots).find((x) => x.clipId === hit.id)
      const moment = hit.analysis?.moments[0]
      const firstLen = first.out - first.in
      if (other) {
        // swap the two shots' footage, keeping each slot's length
        const [aClip, aIn] = [first.clipId, first.in]
        const otherLen = other.out - other.in
        first.clipId = other.clipId
        first.in = Math.max(0, Math.min(other.in, hit.durationSec - firstLen))
        first.out = first.in + Math.min(firstLen, hit.durationSec)
        const aDur = clips.find((c) => c.id === aClip)!.durationSec
        other.clipId = aClip
        other.in = Math.max(0, Math.min(aIn, aDur - otherLen))
        other.out = other.in + Math.min(otherLen, aDur)
      } else if (moment) {
        first.clipId = hit.id
        first.in = moment.start
        first.out = Math.min(hit.durationSec, moment.start + firstLen)
      }
    }
  }

  const note = req.feedback ? `Updated the edit: ${req.feedback.trim()}` : `Matched ${p.scenes.length} scenes to your ${req.narrated ? 'narration' : 'clips'}.`
  return {
    note,
    scenes: p.scenes.map((s) => ({
      lineId: s.lineId ?? '',
      shots: s.shots.map((x) => ({ clipId: x.clipId, in: x.in, out: x.out, focusX: x.crop.focusX, focusY: x.crop.focusY, clipAudio: x.clipAudio, transitionIn: x.transitionIn })),
    })),
  }
}

/** A soft "speech-like" murmur so demo voiceovers are audible and timed. */
async function demoVoice(text: string): Promise<{ audio: Blob; words: Word[] }> {
  const words = estimatedWords(text)
  const duration = (words[words.length - 1]?.end ?? 1) + 0.15
  const rate = 22050
  const ctx = new OfflineAudioContext(1, Math.ceil(duration * rate), rate)
  words.forEach((w, i) => {
    const syllables = Math.max(1, Math.round(w.word.replace(/[^aeiouy]/gi, '').length / 1.5))
    const len = (w.end - w.start) * 0.85
    for (let s = 0; s < syllables; s++) {
      const t0 = w.start + (len / syllables) * s
      const d = (len / syllables) * 0.8
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      const base = 150 + ((i * 37 + s * 23) % 60)
      osc.frequency.setValueAtTime(base, t0)
      osc.frequency.linearRampToValueAtTime(base * 0.9, t0 + d)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(0.18, t0 + d * 0.2)
      gain.gain.linearRampToValueAtTime(0, t0 + d)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + d)
    }
  })
  return { audio: encodeWav(await ctx.startRendering()), words }
}

export const mockAi: AiService = {
  async analyzeClip(req) {
    await latency()
    const { description, tags } = describe(req.fileName)
    const t = tokens(req.fileName)
    const shotType = (t.map((w) => SHOT_WORDS[w]).find(Boolean) ?? (req.speechRatio > 0.5 ? 'talking_head' : 'other')) as ShotType
    // Empty moments → the app uses its own on-device moment ranking.
    return { description, tags, shotType, quality: { shaky: false, blurry: false, dark: false, accidental: false }, moments: [] }
  },

  async writeScript(req) {
    await latency()
    const title = req.title || (req.prompt ? shortTitle(req.prompt) : 'My Day')
    if (req.mode === 'polish') {
      return { title, lines: req.lines.map(polishLine).filter(Boolean).map((text, i, all) => ({ text, purpose: i === 0 ? 'hook' : i === all.length - 1 ? 'outro' : 'story', visualIntent: text, onScreenText: '' })) }
    }
    return { title, lines: writeLines(req) }
  },

  async planEdit(req) {
    await latency()
    return plan(req)
  },

  async synthesize(text) {
    await wait(150)
    return await demoVoice(text)
  },

  async transcribe(audio, _language, knownText) {
    await latency()
    if (!knownText) return { text: '', words: [] }
    const ctx = new OfflineAudioContext(1, 1, 22050)
    const buf = await ctx.decodeAudioData(await audio.arrayBuffer())
    const est = estimatedWords(knownText)
    const scale = buf.duration / Math.max(0.1, est[est.length - 1]?.end ?? 1)
    return { text: knownText, words: est.map((w) => ({ word: w.word, start: w.start * scale, end: w.end * scale })) }
  },
}
