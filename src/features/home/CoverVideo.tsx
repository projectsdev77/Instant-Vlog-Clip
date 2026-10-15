import { useEffect, useRef, useState } from 'react'
import type { CoverItem, ExampleCaption } from './covers'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Muted looping example vlog. With captions, overlays the title and word-by-word captions in the Ember style. */
export function CoverVideo({ item, overlay }: { item: CoverItem; overlay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [t, setT] = useState(0)

  useEffect(() => {
    const v = ref.current
    if (!v || !overlay) return
    let raf = 0
    const tick = () => {
      setT(v.currentTime)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [overlay])

  if (!item.video) return null
  const still = reducedMotion()
  return (
    <>
      <video ref={ref} className="absolute inset-0 size-full object-cover" poster={item.video.poster} autoPlay={!still} muted loop playsInline preload="auto" aria-hidden>
        <source src={item.video.webm} type="video/webm" />
        <source src={item.video.mp4} type="video/mp4" />
      </video>
      {overlay && <Overlay title={item.title} captions={item.captions ?? []} t={still ? 1.5 : t} />}
    </>
  )
}

function Overlay({ title, captions, t }: { title: string; captions: ExampleCaption[]; t: number }) {
  const line = captions.find((c) => t >= c.start && t < c.end)
  const words = line?.text.split(' ') ?? []
  const spoken = line ? Math.min(words.length - 1, Math.floor(((t - line.start) / (line.end - line.start - 0.3)) * words.length)) : -1
  const showTitle = t < 2.4
  return (
    <div className="pointer-events-none absolute inset-0 font-extrabold" aria-hidden>
      <div className="absolute inset-x-[8%] top-[12%] text-center transition-opacity duration-300" style={{ opacity: showTitle ? 1 : 0 }}>
        <span className="box-decoration-clone rounded-[.35em] bg-black/60 px-[.42em] py-[.12em] text-[23px] leading-[1.35] tracking-[-0.02em]">{title}</span>
      </div>
      {line && (
        <div className="absolute inset-x-[8%] top-[64%] text-center">
          <span className="box-decoration-clone rounded-[.35em] bg-black/60 px-[.42em] py-[.12em] text-[15px] leading-[1.6]">
            {words.map((w, i) => (
              <span key={i} className={i === spoken ? 'text-ember-200' : undefined}>
                {w}{i < words.length - 1 ? ' ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}
