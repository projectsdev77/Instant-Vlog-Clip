import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useTutorial } from './tutorial'

export type TourPage = 'clips' | 'script' | 'voice' | 'edit'

type Tip = { id: string; page: TourPage; target: string; title: string; body: string }

/** The tutorial's tips, in order. Each points at an element with data-tour="target". */
export const TIPS: Tip[] = [
  { id: 'clips-add', page: 'clips', target: 'clips-add', title: 'Start with your clips', body: 'Choose a few videos from today. Messy is fine: the shaky and accidental bits get skipped.' },
  { id: 'clips-star', page: 'clips', target: 'clips-grid', title: 'Star the must-haves', body: 'Tap the star on any clip that has to be in the vlog. Tap × to remove one.' },
  { id: 'clips-length', page: 'clips', target: 'length', title: 'Pick a length', body: 'Your narration plays inside it; the rest is your clips with their own sound and music.' },
  { id: 'script-ai', page: 'script', target: 'write-ai', title: 'Let the AI write it', body: 'It writes short lines from what’s in your clips. Or type your own lines: each one becomes a scene.' },
  { id: 'script-template', page: 'script', target: 'template', title: 'Pick a template', body: 'It sets the transitions, camera moves, color and captions. TikTok fast cuts is punchy; Cinematic is slow and filmic.' },
  { id: 'voice-mode', page: 'voice', target: 'voice-mode', title: 'Who tells the story?', body: 'An AI voice reads your lines (tap play to hear one), or record yourself, or show captions only.' },
  { id: 'voice-make', page: 'voice', target: 'make', title: 'Make it', body: 'The AI picks the best moments, cuts them to your lines and adds captions and music.' },
  { id: 'edit-preview', page: 'edit', target: 'preview', title: 'Your vlog', body: 'Tap to play. What you see here is exactly what you’ll export.' },
  { id: 'edit-scenes', page: 'edit', target: 'scenes', title: 'Change any scene', body: 'Tap a scene to swap shots, split, freeze, change speed, or add a zoom or transition.' },
  { id: 'edit-look', page: 'edit', target: 'tab-look', title: 'Change the whole look', body: 'Switch templates, add a filter, or tweak color and fades. Your footage stays.' },
  { id: 'edit-ai', page: 'edit', target: 'tell-ai', title: 'Or just ask', body: 'Tell the AI what to change in plain words, like “make it punchier” or “open with the sunset”.' },
  { id: 'edit-export', page: 'edit', target: 'export', title: 'Export', body: 'Made right on your device, sized for TikTok, Reels and Shorts. That’s it!' },
]

function visibleTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
  }
  return null
}

const GAP = 12
const MARGIN = 16

/**
 * Step-by-step tips for first-time visitors: a ring around the control and
 * a bubble next to it. Doesn't block the page: people can follow the tip,
 * tap Next, or skip the tour. Doing the thing the tip points at also counts.
 */
export function Tour({ page }: { page: TourPage }) {
  const { active, done, markDone, skip, finish } = useTutorial()
  const [, force] = useState(0)
  const [tip, setTip] = useState<Tip | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 320, h: 160 })
  const shown = active && !!tip && !!rect

  // Pick the first unseen tip on this page whose target is on screen (re-checked as the page changes).
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = ''
    const tick = () => {
      const next = TIPS.find((t) => t.page === page && !done.includes(t.id) && visibleTarget(t.target)) ?? null
      const el = next && visibleTarget(next.target)
      if (next?.id !== last) {
        last = next?.id ?? ''
        setTip(next)
        if (el) {
          const r = el.getBoundingClientRect()
          if (r.top < 70 || r.bottom > window.innerHeight - 120) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      }
      if (el) {
        const r = el.getBoundingClientRect()
        setRect((p) => (p && p.x === r.x && p.y === r.y && p.width === r.width && p.height === r.height ? p : r))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, done, page])

  // Using the control the tip points at counts as "got it".
  useEffect(() => {
    if (!tip) return
    const onClick = (e: MouseEvent) => {
      const el = visibleTarget(tip.target)
      if (el && e.target instanceof Node && el.contains(e.target)) markDone(tip.id)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [tip, markDone])

  // Measure the bubble so it can sit above or below the control without going off screen.
  useEffect(() => {
    const b = bubble.current
    if (!b) return
    const ro = new ResizeObserver(() => setSize({ w: b.offsetWidth, h: b.offsetHeight }))
    ro.observe(b)
    return () => ro.disconnect()
  }, [tip, shown])

  useEffect(() => {
    const onResize = () => force((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!active || !tip || !rect) return null

  const all = TIPS.findIndex((t) => t.id === tip.id)
  const lastOfTour = all === TIPS.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(340, vw - MARGIN * 2)
  const below = rect.bottom + GAP + size.h < vh - MARGIN
  const above = rect.top - GAP - size.h > MARGIN
  let top = below ? rect.bottom + GAP : above ? rect.top - GAP - size.h : Math.max(MARGIN, vh - size.h - 110)
  top = Math.max(MARGIN, Math.min(top, vh - size.h - MARGIN))
  const left = Math.max(MARGIN, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - MARGIN))
  const arrowX = Math.max(22, Math.min(rect.left + rect.width / 2 - left, w - 22))
  const showArrow = below || above
  const pad = 6

  const next = () => {
    markDone(tip.id)
    if (lastOfTour) finish()
  }

  return (
    <>
      <div
        className="pointer-events-none fixed z-40 rounded-[18px] transition-all duration-200 ease-ember"
        style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 2.5px #ff5a1f, 0 0 0 9999px rgba(0,0,0,.42)' }}
        aria-hidden
      />
      <div
        ref={bubble}
        role="dialog"
        aria-label={`Tip: ${tip.title}`}
        className="fixed z-40 rounded-[20px] bg-white p-4 pr-3 text-ink shadow-lift animate-[fade_.16s_ease-out]"
        style={{ left, top, width: w }}
      >
        {showArrow && <span className="absolute size-3.5 rotate-45 bg-white" style={{ left: arrowX - 7, ...(below ? { top: -7 } : { bottom: -7 }) }} aria-hidden />}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold tracking-wide text-[#c2410c] uppercase">
              Tip {all + 1} of {TIPS.length}
            </div>
            <div className="mt-0.5 text-[16px] leading-snug font-extrabold">{tip.title}</div>
            <p className="mt-1 text-[14px] leading-snug text-[#3f3a36]">{tip.body}</p>
          </div>
          <button type="button" onClick={skip} className="-mt-1 grid size-9 shrink-0 place-items-center rounded-full text-[#6b6460] hover:bg-black/5" aria-label="Skip the tutorial">
            <X className="size-4" strokeWidth={2.6} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={skip} className="h-9 rounded-full px-2 text-[13px] font-semibold text-[#6b6460] hover:text-ink">
            Skip tutorial
          </button>
          <button type="button" onClick={next} className="h-9 rounded-full bg-ink px-4 text-[14px] font-bold text-white">
            {lastOfTour ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
