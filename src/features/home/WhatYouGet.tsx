import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { COVER_BG } from './covers'

/**
 * Home "What you get": four text cards and two video tiles in one grid
 * (design handoff "What you get"). Replaces the icon cards and the privacy banner.
 */
export function WhatYouGet() {
  return (
    <section className="relative mx-auto flex max-w-[1120px] flex-col gap-7 px-4 pt-10 pb-2 md:px-10 md:pt-[72px] md:pb-6" aria-labelledby="what-you-get">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-semibold tracking-[.14em] text-ember-300 uppercase">What you get</span>
          <h2 id="what-you-get" className="max-w-[520px] text-[clamp(34px,4.4vw,52px)] leading-none font-extrabold tracking-[-0.045em] text-balance">
            A vlog that sounds like you made it.
          </h2>
        </div>
        <p className="max-w-[340px] text-[15px] leading-normal text-pretty text-white/62">Voice, captions, music and the cut, all handled. You just bring the day.</p>
      </div>

      <div className="grid auto-rows-auto grid-cols-2 gap-3.5 md:auto-rows-[minmax(300px,auto)] md:grid-cols-4">
        <Card light label="Voice" title="Narrated by AI or by you" body="Six natural voices, or read your lines with the built-in teleprompter.">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex">
              {[
                ['A', 'bg-accent text-white'],
                ['L', 'bg-ink text-white'],
                ['M', 'bg-[#e9e4df] text-ink'],
                ['+3', 'bg-[#e9e4df] text-ink text-[11px]'],
              ].map(([t, c], i) => (
                <span key={t} className={`grid size-8 place-items-center rounded-full text-[13px] font-extrabold shadow-[0_0_0_2px_#fff] ${c} ${i ? '-ml-2' : ''}`}>
                  {t}
                </span>
              ))}
            </div>
            <span className="text-[13px] font-semibold text-ink/60">or your own voice</span>
          </div>
        </Card>

        <Card label="Captions" title="Captions that follow along" body="Every word lights up as it’s spoken, in a style you pick.">
          <div className="flex flex-wrap gap-1.5">
            {['Ember', 'Classic', 'Bold', '+3'].map((s, i) => (
              <span key={s} className={`flex h-[30px] flex-none items-center rounded-full px-3 text-[12px] whitespace-nowrap ${i === 0 ? 'bg-white font-bold text-ink' : 'bg-surface-2 font-semibold'}`}>
                {s}
              </span>
            ))}
          </div>
        </Card>

        <VideoTile name="vlogger" bg={COVER_BG.day} shade="linear-gradient(180deg,rgba(0,0,0,.25) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%)">
          <Chip className="top-4 left-4">
            <span className="size-1.5 rounded-full bg-[#ff4f4f]" />
            Live captions
          </Chip>
          <div className="absolute inset-x-6 bottom-7 flex justify-center">
            <LiveCaption />
          </div>
        </VideoTile>

        <VideoTile name="cafe-selfie" bg={COVER_BG.over} shade="linear-gradient(90deg,rgba(0,0,0,.7) 0%,rgba(0,0,0,.3) 50%,rgba(0,0,0,0) 80%)">
          <Chip className="tabular top-4 right-4">9:16 · 1080p</Chip>
          <div className="absolute inset-x-[26px] bottom-[26px] flex max-w-[340px] flex-col gap-2.5">
            <span className="text-[13px] font-bold text-ember-200">Export</span>
            <span className="text-[28px] leading-[1.05] font-extrabold tracking-[-0.03em]">Ready to post</span>
            <span className="text-[15px] leading-normal text-pretty text-white/85">Vertical by default, sized for TikTok, Reels and Shorts. Share straight from your phone.</span>
          </div>
        </VideoTile>

        <Card label="Music" title="Music that knows when to dip" body="A soundtrack for the mood, quieter whenever someone talks.">
          <div className="flex flex-col gap-2" aria-hidden>
            <div className="flex h-10 items-end gap-[3px]">
              {DUCK.map((b, i) => (
                <span key={i} className="flex-1 rounded-[2px]" style={{ height: b.h, background: b.c }} />
              ))}
            </div>
            <div className="flex justify-between text-[12px] font-semibold text-white/45">
              <span>music</span>
              <span className="text-ember-300">voice</span>
              <span>music</span>
            </div>
          </div>
        </Card>

        <Card label="Privacy" title="Your videos never leave your device" body="The AI sees small preview frames and your script, never your footage." glow>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white/80">
            <Lock className="size-[15px]" strokeWidth={2.2} />
            Made in your browser
          </div>
        </Card>
      </div>
    </section>
  )
}

/** Ducking meter: music bars tall, voice bars short and ember. */
const DUCK = Array.from({ length: 24 }, (_, i) => {
  const voice = i >= 8 && i < 16
  const h = voice ? 18 + ((i * 37) % 5) * 3 : 46 + ((i * 53) % 7) * 8
  return { h: `${Math.min(100, h)}%`, c: voice ? '#ff7a3d' : 'rgba(255,255,255,.22)' }
})

function Card({ label, title, body, light, glow, children }: { label: string; title: string; body: string; light?: boolean; glow?: boolean; children: ReactNode }) {
  return (
    <div className={`relative flex min-w-0 flex-col justify-between gap-6 overflow-hidden rounded-[24px] p-[26px] ${light ? 'bg-white text-ink' : 'bg-surface'}`}>
      {glow && <div className="pointer-events-none absolute -right-[90px] -bottom-[110px] size-[280px] rounded-full bg-[radial-gradient(circle,rgba(255,106,36,.35)_0%,rgba(255,106,36,0)_68%)]" aria-hidden />}
      <div className="relative flex flex-col gap-2.5">
        <span className={`text-[13px] font-bold ${light ? 'text-[#c2340a]' : 'text-ember-300'}`}>{label}</span>
        <h3 className="text-[22px] leading-[1.15] font-bold tracking-[-0.02em] text-balance">{title}</h3>
        <p className={`text-[15px] leading-normal text-pretty ${light ? 'text-ink/66' : 'text-white/62'}`}>{body}</p>
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`absolute flex h-[30px] items-center gap-[7px] rounded-full bg-black/50 px-3 text-[12px] font-bold whitespace-nowrap backdrop-blur-[8px] ${className}`}>{children}</span>
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Muted looping video that only loads once it's near the screen (after the hero). */
function VideoTile({ name, bg, shade, children }: { name: string; bg: string; shade: string; children: ReactNode }) {
  const tile = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = tile.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const v = video.current
    if (!near || !v || reducedMotion()) return
    // React doesn't reliably set the muted attribute; browsers only autoplay muted video.
    v.muted = true
    v.load()
    void v.play().catch(() => {})
  }, [near])

  return (
    <div ref={tile} className="relative col-span-2 min-h-[300px] overflow-hidden rounded-[24px]" style={{ background: bg }}>
      <video ref={video} className="absolute inset-0 size-full object-cover" poster={`/examples/${name}.jpg`} muted loop playsInline preload="none" aria-hidden>
        {near && <source src={`/examples/${name}.webm`} type="video/webm" />}
        {near && <source src={`/examples/${name}.mp4`} type="video/mp4" />}
      </video>
      <div className="absolute inset-0" style={{ background: shade }} />
      {children}
    </div>
  )
}

const DEMO = 'Coffee first, then the whole lake loop. Best part? Golden hour.'.split(' ')

/** Ember-style caption, 4 words at a time, highlight moving every 340 ms. */
function LiveCaption() {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reducedMotion()) return
    const t = setInterval(() => setI((n) => (n + 1) % DEMO.length), 340)
    return () => clearInterval(t)
  }, [])
  const still = reducedMotion()
  const start = still ? 0 : Math.floor(i / 4) * 4
  return (
    <div className="flex flex-wrap justify-center gap-x-[.26em] rounded-[.35em] bg-black/60 px-[.5em] py-[.14em] text-[clamp(20px,2.4vw,28px)] leading-[1.25] font-extrabold tracking-[-0.01em]" aria-hidden>
      {DEMO.slice(start, start + 4).map((w, j) => (
        <span key={`${start}-${j}`} style={{ color: !still && start + j === i ? '#ffa25a' : '#fff' }}>
          {w}
        </span>
      ))}
    </div>
  )
}
