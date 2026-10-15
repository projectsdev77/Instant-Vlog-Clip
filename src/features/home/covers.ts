/** Placeholder "footage" gradients from the design, shown while videos load. */
export const COVER_BG = {
  day: 'linear-gradient(170deg,#f4dcae 0%,#d9a55e 28%,#6f7d3c 62%,#1c2414 100%)',
  over: 'linear-gradient(170deg,#a9b6c3 0%,#64738a 38%,#2a3240 74%,#111418 100%)',
  mono: 'linear-gradient(200deg,#e0e0e0 0%,#8c8c8c 34%,#2c2c2c 72%,#0d0d0d 100%)',
  gold: 'radial-gradient(120% 80% at 70% 25%,#ffd2a1 0%,#ff7a2e 30%,#5a1503 72%,#0a0a0a 100%)',
  sea: 'linear-gradient(175deg,#cfe6ea 0%,#6fa7b4 34%,#2b5763 70%,#0c1a1f 100%)',
  night: 'linear-gradient(180deg,#2b2f4a 0%,#1a1c30 45%,#3a2a2a 80%,#0a0a0f 100%)',
}

/** A caption line shown from `start` to `end` seconds of the example video. */
export type ExampleCaption = { start: number; end: number; text: string }

export type CoverItem = {
  id?: string
  title: string
  meta: string
  image?: string
  bg: string
  tag?: string
  /** example vlog video (public/examples), muted loop */
  video?: { mp4: string; webm: string; poster: string }
  captions?: ExampleCaption[]
}

const ex = (name: string) => ({ mp4: `/examples/${name}.mp4`, webm: `/examples/${name}.webm`, poster: `/examples/${name}.jpg` })

// Example footage: Mixkit free stock videos (mixkit.co, Mixkit License), cut into 7.8 s vlogs.
export const EXAMPLES: CoverItem[] = [
  {
    title: 'A day at the lake',
    meta: 'Example · 0:08',
    bg: COVER_BG.sea,
    tag: 'Example',
    video: ex('lake'),
    captions: [
      { start: 0.2, end: 2.6, text: 'So we finally made it to the lake…' },
      { start: 2.6, end: 5.2, text: 'The sunset was unreal tonight.' },
      { start: 5.2, end: 7.8, text: 'Best day with my favourite people.' },
    ],
  },
  { title: 'Rainy café morning', meta: 'Example · 0:08', bg: COVER_BG.over, video: ex('cafe') },
  { title: 'Weekend with friends', meta: 'Example · 0:08', bg: COVER_BG.mono, video: ex('friends') },
]

export const FALLBACK_BGS = [COVER_BG.day, COVER_BG.over, COVER_BG.mono, COVER_BG.sea, COVER_BG.night, COVER_BG.gold]
