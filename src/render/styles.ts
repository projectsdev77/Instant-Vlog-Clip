import type { Aspect, StyleId } from '@/domain/types'

export type TextCase = 'sentence' | 'title' | 'upper'

export type TextStyle = {
  id: StyleId
  name: string
  description: string
  font: string
  weight: number
  titleCase: TextCase
  captionCase: TextCase
  captionColor: string
  /** current spoken word; same as captionColor for none */
  highlightColor: string
  /** outline / shadow for legibility on any footage; null for none */
  outline: { color: string; blur: number; strength: 'soft' | 'normal' | 'heavy' } | null
  /** box behind each caption line; null for none */
  box: string | null
}

export const VIDEO_FONT = "'Plus Jakarta Sans', system-ui, sans-serif"

/** Caption presets from the design handoff. These are burned into exported videos. */
export const STYLES: TextStyle[] = [
  { id: 'ember', name: 'Ember', description: 'Dark pill, warm highlight', font: VIDEO_FONT, weight: 800, titleCase: 'sentence', captionCase: 'sentence', captionColor: '#ffffff', highlightColor: '#ffa25a', outline: null, box: 'rgba(0,0,0,0.6)' },
  { id: 'classic', name: 'Classic', description: 'Yellow highlight, outline', font: VIDEO_FONT, weight: 800, titleCase: 'title', captionCase: 'title', captionColor: '#ffffff', highlightColor: '#ffd84d', outline: { color: 'rgba(0,0,0,0.85)', blur: 6, strength: 'normal' }, box: null },
  { id: 'bold', name: 'Bold', description: 'All caps, green pop', font: VIDEO_FONT, weight: 800, titleCase: 'upper', captionCase: 'upper', captionColor: '#ffffff', highlightColor: '#4dff9a', outline: { color: 'rgba(0,0,0,0.95)', blur: 6, strength: 'heavy' }, box: null },
  { id: 'minimal', name: 'Minimal', description: 'Sentence case, soft shadow', font: VIDEO_FONT, weight: 600, titleCase: 'sentence', captionCase: 'sentence', captionColor: '#ffffff', highlightColor: '#ffffff', outline: { color: 'rgba(0,0,0,0.45)', blur: 8, strength: 'soft' }, box: null },
  { id: 'neon', name: 'Box', description: 'Dark text on white', font: VIDEO_FONT, weight: 800, titleCase: 'title', captionCase: 'title', captionColor: '#111111', highlightColor: '#e0218a', outline: null, box: '#ffffff' },
]

export const styleById = (id: StyleId) => STYLES.find((s) => s.id === id) ?? STYLES[0]

export function applyCase(text: string, c: TextCase): string {
  if (c === 'upper') return text.toUpperCase()
  if (c === 'title') return text.replace(/(^|\s)(\p{L})/gu, (_, sp: string, ch: string) => sp + ch.toUpperCase())
  return text
}

/** Makes sure the video font is ready before drawing text onto frames. */
export async function loadVideoFont(): Promise<void> {
  try {
    await Promise.all([document.fonts.load(`800 48px 'Plus Jakarta Sans'`), document.fonts.load(`600 48px 'Plus Jakarta Sans'`)])
  } catch {
    /* falls back to the system font */
  }
}

export function outputSize(aspect: Aspect, long = 1920): { width: number; height: number } {
  const short = Math.round((long * 9) / 16 / 2) * 2
  if (aspect === '9:16') return { width: short, height: long }
  if (aspect === '16:9') return { width: long, height: short }
  return { width: short, height: short }
}
