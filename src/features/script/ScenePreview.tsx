import { useEffect, useRef, useState } from 'react'
import type { Aspect, Clip } from '@/domain/types'
import { rankedMoments } from '@/domain/moments'
import { getMediaUrl } from '@/lib/mediaStore'

/** A still frame from the clip's best moment (falls back to the thumbnail). */
export function ClipStill({ clip, className }: { clip?: Clip; className?: string }) {
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null)
  const ref = useRef<HTMLVideoElement>(null)
  const key = clip?.mediaKey
  useEffect(() => {
    let alive = true
    if (key) void getMediaUrl(key).then((u) => alive && u && setLoaded({ key, url: u }))
    return () => {
      alive = false
    }
  }, [key])
  const url = loaded && loaded.key === key ? loaded.url : null
  if (!clip) return null
  const m = rankedMoments(clip)[0]
  const at = m ? (m.start + m.end) / 2 : Math.min(1, clip.durationSec / 3)
  return (
    <>
      {clip.thumbnail && <img src={clip.thumbnail} alt="" className={className} />}
      {url && (
        <video
          ref={ref}
          src={url}
          muted
          playsInline
          preload="auto"
          className={className}
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = Math.min(at, Math.max(0, clip.durationSec - 0.1))
          }}
          aria-hidden
        />
      )}
    </>
  )
}

const FRAME: Record<Aspect, React.CSSProperties> = {
  '9:16': { height: 340, aspectRatio: '9 / 16' },
  '1:1': { height: 280, aspectRatio: '1 / 1' },
  '16:9': { width: 'calc(100% - 48px)', aspectRatio: '16 / 9' },
}

/** Desktop live preview of the scene being written: its clip, the title on scene 1, and the line as a caption. */
export function ScenePreview({ aspect, clip, title, text, index, total, showTitle }: { aspect: Aspect; clip?: Clip; title: string; text: string; index: number; total: number; showTitle: boolean }) {
  return (
    <div className="relative grid h-[420px] place-items-center overflow-hidden rounded-[24px] bg-[#0b0b0c] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" aria-label="Preview of the scene" role="img">
      <div className="pointer-events-none absolute -top-[130px] left-1/2 h-[260px] w-[360px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(255,106,36,.22)_0%,rgba(255,106,36,0)_65%)]" aria-hidden />
      <div className="relative overflow-hidden rounded-[18px] bg-surface-2 shadow-[0_0_0_1.5px_rgba(255,255,255,.2),0_30px_60px_rgba(0,0,0,.55)]" style={FRAME[aspect]}>
        <ClipStill clip={clip} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.2),transparent_35%,rgba(0,0,0,.5))]" />
        {showTitle && title && <div className="absolute inset-x-[8%] top-[16%] text-center text-[20px] leading-tight font-extrabold tracking-[-0.03em] text-balance">{title}</div>}
        <div className="absolute inset-x-[8%] bottom-[12%] flex justify-center">
          <span className={`rounded-[8px] bg-black/60 px-2.5 py-1 text-center text-[14px] leading-[1.3] font-extrabold ${text ? '' : 'text-white/55'}`}>{text || 'Your line shows here'}</span>
        </div>
      </div>
      <span className="tabular absolute top-4 left-4 flex h-7 items-center rounded-full bg-black/50 px-3 text-[12px] font-bold">
        Scene {index + 1} of {total}
      </span>
    </div>
  )
}
