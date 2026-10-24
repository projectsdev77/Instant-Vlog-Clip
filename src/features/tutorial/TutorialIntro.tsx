import { useState, type ReactNode } from 'react'
import { ArrowLeft, Mic, Play, Sparkles, Star, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { cn } from '@/lib/cn'
import { CoverVideo } from '@/features/home/CoverVideo'
import { EXAMPLES } from '@/features/home/covers'
import { useTutorial } from './tutorial'

type Slide = { eyebrow: string; title: string; body: string; art: ReactNode }

const POSTERS = ['/examples/lake.jpg', '/examples/cafe.jpg', '/examples/friends.jpg']

const SLIDES: Slide[] = [
  {
    eyebrow: 'Welcome',
    title: 'Your clips, made into a vlog',
    body: 'Here’s how it goes, from your clips to a finished vlog you can post.',
    art: (
      <Phone>
        <CoverVideo item={EXAMPLES[0]} overlay />
      </Phone>
    ),
  },
  {
    eyebrow: 'Clips',
    title: 'Add your clips',
    body: 'Pick a few videos from today. Messy is fine: shaky and accidental bits get skipped. Star any clip that has to be in.',
    art: (
      <div className="flex items-end justify-center gap-2.5">
        {POSTERS.map((src, i) => (
          <div key={src} className={cn('relative aspect-[9/16] w-[86px] overflow-hidden rounded-[14px] bg-surface-2', i === 1 && 'shadow-[0_0_0_2px_#ff5a1f]')}>
            <img src={src} alt="" className="size-full object-cover" />
            <span className={cn('absolute top-1.5 left-1.5 grid size-7 place-items-center rounded-full', i === 1 ? 'bg-accent' : 'bg-black/50')}>
              <Star className="size-3.5" strokeWidth={2.4} fill={i === 1 ? 'currentColor' : 'none'} />
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: 'Script',
    title: 'Say what happened',
    body: 'Type a few short lines, or let the AI write them from what’s in your clips. Each line becomes a scene.',
    art: (
      <div className="mx-auto w-full max-w-[300px] space-y-2">
        {['So we finally made it to the lake…', 'Started with the best coffee in town.', 'Ended the night around a campfire.'].map((l, i) => (
          <div key={l} className="flex items-center gap-2.5 rounded-full bg-surface-2 px-4 py-2.5 text-[14px] font-medium" style={{ opacity: 1 - i * 0.18 }}>
            <span className="tabular text-[12px] font-bold text-ember-300">{i + 1}</span>
            {l}
          </div>
        ))}
        <div className="flex justify-center pt-1">
          <span className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-ink">
            <Sparkles className="size-4" strokeWidth={2.4} /> Write it for me
          </span>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Voice',
    title: 'Pick a voice and a style',
    body: 'An AI voice reads your lines, or record your own over the finished video. The template sets the transitions, effects and color, from cozy to TikTok fast cuts.',
    art: (
      <div className="mx-auto w-full max-w-[320px] space-y-3">
        <div className="flex flex-wrap justify-center gap-2">
          {['Mia', 'Sam', 'Zoe', 'Will'].map((v, i) => (
            <span key={v} className={cn('flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold', i === 0 ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_#ff5a1f]' : 'bg-surface-2')}>
              <Mic className="size-3.5" strokeWidth={2.4} /> {v}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {['Day in my life', 'TikTok fast cuts', 'Cinematic'].map((t, i) => (
            <span key={t} className={cn('rounded-full px-3.5 py-2 text-[13px] font-semibold', i === 1 ? 'bg-white text-ink' : 'bg-surface-2 text-muted')}>
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Make and edit',
    title: 'Tweak it, then export',
    body: 'The AI cuts it together with captions and music. Tap any scene to swap shots or add effects, or just tell the AI what to change. Your videos stay on your device.',
    art: (
      <div className="flex items-center justify-center gap-4">
        <Phone small>
          <CoverVideo item={EXAMPLES[1]} />
        </Phone>
        <div className="w-[170px] space-y-2">
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-2 text-[12px] font-medium text-muted">
            <Wand2 className="size-3.5 text-ember-300" strokeWidth={2.4} /> “make it punchier”
          </span>
          {['Slow-mo', 'Zoom in', 'Whip'].map((c) => (
            <span key={c} className="mr-1.5 inline-block rounded-full bg-surface-2 px-3 py-1.5 text-[12px] font-semibold">
              {c}
            </span>
          ))}
          <span className="block w-fit rounded-full bg-accent px-4 py-2 text-[13px] font-bold">Export</span>
        </div>
      </div>
    ),
  },
]

function Phone({ children, small }: { children: ReactNode; small?: boolean }) {
  return (
    <div className={cn('relative mx-auto aspect-[9/16] overflow-hidden rounded-[22px] bg-black shadow-[0_0_0_1.5px_rgb(255_255_255/.14),0_24px_48px_rgb(0_0_0/.5)]', small ? 'w-[120px]' : 'w-[170px]')}>
      {children}
    </div>
  )
}

/** Shown once on a first visit (and from "How it works"): what the app does, then start with sample clips or your own. */
export function TutorialIntro({ onTrySample, onOwnClips }: { onTrySample: () => void; onOwnClips: () => void }) {
  const { introOpen, skip, start } = useTutorial()
  const [i, setI] = useState(0)
  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1
  const close = () => {
    skip()
    setI(0)
  }
  return (
    <Sheet open={introOpen} onClose={close} title="How it works" hideTitle wide>
      <div className="flex min-h-[520px] flex-col md:min-h-[500px]" aria-live="polite">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{slide.eyebrow}</span>
          <button type="button" onClick={close} className="-mr-2 h-10 rounded-full px-3 text-[14px] font-semibold text-muted hover:text-fg">
            Skip
          </button>
        </div>
        <div className="flex min-h-[290px] flex-1 items-center justify-center py-5">{slide.art}</div>
        <h2 className="title-1 text-balance">{slide.title}</h2>
        <p className="mt-2 text-[16px] text-muted">{slide.body}</p>
        <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
          {SLIDES.map((_, k) => (
            <span key={k} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-accent' : 'w-1.5 bg-white/20')} />
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2.5 md:flex-row-reverse">
          {last ? (
            <>
              <Button
                variant="ember"
                block
                onClick={() => {
                  start()
                  setI(0)
                  onTrySample()
                }}
              >
                <Play className="size-4" fill="currentColor" /> Try it with sample clips
              </Button>
              <Button
                variant="quiet"
                block
                onClick={() => {
                  start()
                  setI(0)
                  onOwnClips()
                }}
              >
                Use my own clips
              </Button>
            </>
          ) : (
            <>
              <Button block onClick={() => setI(i + 1)}>
                {i === 0 ? 'Show me' : 'Next'}
              </Button>
              {i > 0 && (
                <Button variant="quiet" block onClick={() => setI(i - 1)}>
                  <ArrowLeft className="size-4" strokeWidth={2.4} /> Back
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Sheet>
  )
}
