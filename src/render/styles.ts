import type { Aspect, StyleId } from '@/domain/types'

export type TextStyle = {
  id: StyleId
  name: string
  font: string
  weight: number
  uppercaseTitle: boolean
  uppercaseCaptions: boolean
  titleColor: string
  captionColor: string
  /** current spoken word */
  highlightColor: string
  /** outline / shadow for legibility on any footage */
  stroke: string
  /** caption background box; null for none */
  box: string | null
}

export const STYLES: TextStyle[] = [
  { id: 'classic', name: 'Classic', font: 'Inter, system-ui, sans-serif', weight: 800, uppercaseTitle: true, uppercaseCaptions: false, titleColor: '#ffffff', captionColor: '#ffffff', highlightColor: '#ffd84d', stroke: 'rgba(0,0,0,0.85)', box: null },
  { id: 'bold', name: 'Bold', font: 'Inter, system-ui, sans-serif', weight: 900, uppercaseTitle: true, uppercaseCaptions: true, titleColor: '#ffffff', captionColor: '#ffffff', highlightColor: '#4dff9a', stroke: 'rgba(0,0,0,0.95)', box: null },
  { id: 'minimal', name: 'Minimal', font: 'Inter, system-ui, sans-serif', weight: 600, uppercaseTitle: false, uppercaseCaptions: false, titleColor: '#ffffff', captionColor: '#ffffff', highlightColor: '#ffffff', stroke: 'rgba(0,0,0,0.45)', box: null },
  { id: 'neon', name: 'Box', font: 'Inter, system-ui, sans-serif', weight: 800, uppercaseTitle: true, uppercaseCaptions: false, titleColor: '#ffffff', captionColor: '#111111', highlightColor: '#e0218a', stroke: 'rgba(0,0,0,0)', box: 'rgba(255,255,255,0.95)' },
]

export const styleById = (id: StyleId) => STYLES.find((s) => s.id === id) ?? STYLES[0]

export function outputSize(aspect: Aspect, long = 1920): { width: number; height: number } {
  const short = Math.round((long * 9) / 16 / 2) * 2
  if (aspect === '9:16') return { width: short, height: long }
  if (aspect === '16:9') return { width: long, height: short }
  return { width: short, height: short }
}
