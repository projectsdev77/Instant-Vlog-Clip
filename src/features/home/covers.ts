/** Placeholder "footage" gradients from the design, used for examples. */
export const COVER_BG = {
  day: 'linear-gradient(170deg,#f4dcae 0%,#d9a55e 28%,#6f7d3c 62%,#1c2414 100%)',
  over: 'linear-gradient(170deg,#a9b6c3 0%,#64738a 38%,#2a3240 74%,#111418 100%)',
  mono: 'linear-gradient(200deg,#e0e0e0 0%,#8c8c8c 34%,#2c2c2c 72%,#0d0d0d 100%)',
  gold: 'radial-gradient(120% 80% at 70% 25%,#ffd2a1 0%,#ff7a2e 30%,#5a1503 72%,#0a0a0a 100%)',
  sea: 'linear-gradient(175deg,#cfe6ea 0%,#6fa7b4 34%,#2b5763 70%,#0c1a1f 100%)',
  night: 'linear-gradient(180deg,#2b2f4a 0%,#1a1c30 45%,#3a2a2a 80%,#0a0a0f 100%)',
}

export type CoverItem = { id?: string; title: string; meta: string; image?: string; bg: string; tag?: string }

export const EXAMPLES: CoverItem[] = [
  { title: 'A day at the lake', meta: 'Example · 0:18', bg: COVER_BG.sea, tag: 'Example' },
  { title: 'Rainy café morning', meta: 'Example · 0:22', bg: COVER_BG.over },
  { title: 'Film walk downtown', meta: 'Example · 0:31', bg: COVER_BG.mono },
]

export const FALLBACK_BGS = [COVER_BG.day, COVER_BG.over, COVER_BG.mono, COVER_BG.sea, COVER_BG.night, COVER_BG.gold]
