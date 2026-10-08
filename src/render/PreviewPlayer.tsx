import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { Project } from '@/domain/types'
import { shotAt, TRANSITION_SEC, type Timeline, type TimelineShot } from '@/domain/timeline'
import { formatDuration } from '@/lib/format'
import { getMediaUrl } from '@/lib/mediaStore'
import { Spinner } from '@/components/ui/Spinner'
import { drawFrame } from './compositor'
import { outputSize, styleById } from './styles'

type Props = {
  timeline: Timeline
  project: Project
  mix: AudioBuffer | null
  /** bump `n` to seek */
  seek?: { t: number; n: number }
  onTime?: (t: number) => void
}

/**
 * Plays the edit in real time without rendering a file: video elements are
 * drawn onto a canvas by the same compositor the exporter uses, and the
 * pre-mixed soundtrack is the master clock.
 */
export function PreviewPlayer({ timeline, project, mix, seek, onTime }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const videos = useRef(new Map<string, HTMLVideoElement>())
  const audio = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode | null; startedAt: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const timeRef = useRef(0)
  const playingRef = useRef(false)
  const tlRef = useRef(timeline)
  const mixRef = useRef(mix)
  const { width, height } = outputSize(project.settings.aspect, 960)
  const style = styleById(project.styleId)
  const styleRef = useRef(style)
  useEffect(() => {
    tlRef.current = timeline
    mixRef.current = mix
    styleRef.current = style
  })

  // One hidden <video> per clip in the edit.
  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const ids = new Set(timeline.shots.map((s) => s.clip.id))
    for (const s of timeline.shots) {
      if (videos.current.has(s.clip.id)) continue
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      v.preload = 'auto'
      v.crossOrigin = 'anonymous'
      holder.appendChild(v)
      videos.current.set(s.clip.id, v)
      void getMediaUrl(s.clip.mediaKey).then((url) => {
        if (url) v.src = url
      })
    }
    for (const [id, v] of videos.current) {
      if (!ids.has(id)) {
        v.pause()
        v.remove()
        videos.current.delete(id)
      }
    }
  }, [timeline])

  const stopAudio = useCallback(() => {
    const a = audio.current
    if (a?.src) {
      a.src.onended = null
      a.src.stop()
      a.src.disconnect()
      a.src = null
    }
  }, [])

  const startAudio = useCallback(
    (from: number) => {
      audio.current ??= { ctx: new AudioContext(), src: null, startedAt: 0 }
      const a = audio.current
      stopAudio()
      void a.ctx.resume()
      if (mixRef.current) {
        const src = a.ctx.createBufferSource()
        src.buffer = mixRef.current
        src.connect(a.ctx.destination)
        src.start(0, Math.min(from, mixRef.current.duration))
        a.src = src
      }
      a.startedAt = a.ctx.currentTime - from
    },
    [stopAudio],
  )

  const pause = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    stopAudio()
    videos.current.forEach((v) => v.pause())
  }, [stopAudio])

  const play = useCallback(() => {
    let from = timeRef.current
    if (from >= tlRef.current.duration - 0.05) from = 0
    timeRef.current = from
    startAudio(from)
    playingRef.current = true
    setPlaying(true)
  }, [startAudio])

  const seekTo = useCallback(
    (t: number) => {
      timeRef.current = Math.max(0, Math.min(t, tlRef.current.duration))
      setTime(timeRef.current)
      if (playingRef.current) startAudio(timeRef.current)
    },
    [startAudio],
  )

  useEffect(() => {
    if (seek) seekTo(seek.t)
  }, [seek, seekTo])

  // New soundtrack (edit changed) while playing: restart audio at the same spot.
  useEffect(() => {
    if (playingRef.current) startAudio(timeRef.current)
  }, [mix, startAudio])

  useEffect(() => () => {
    stopAudio()
    void audio.current?.ctx.close()
    videos.current.forEach((v) => {
      v.pause()
      v.remove()
    })
    videos.current.clear()
  }, [stopAudio])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let lastReported = -1
    let drawnOnce = false
    const frame = () => {
      const tl = tlRef.current
      if (playingRef.current && audio.current) {
        timeRef.current = audio.current.ctx.currentTime - audio.current.startedAt
        if (timeRef.current >= tl.duration) {
          timeRef.current = tl.duration
          pause()
        }
      }
      const t = Math.min(timeRef.current, Math.max(0, tl.duration - 0.001))
      syncVideos(tl, t, playingRef.current, videos.current)
      // Keep the last frame on screen while the next clip is still loading.
      const cur = shotAt(tl, t)
      const curVideo = cur && videos.current.get(cur.clip.id)
      const ready = !!curVideo && curVideo.readyState >= 2
      if (ready || !drawnOnce) drawnOnce = drawFrame(ctx, canvas.width, canvas.height, t, tl, (s: TimelineShot) => {
        const v = videos.current.get(s.clip.id)
        return v && v.readyState >= 2 ? v : null
      }, styleRef.current) || ready
      if (Math.abs(t - lastReported) > 0.1) {
        lastReported = t
        setTime(t)
        onTime?.(t)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [pause, onTime])

  const ended = time >= timeline.duration - 0.05 && !playing
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-black shadow-lg" style={{ aspectRatio: `${width} / ${height}`, height: 'min(58vh, 640px)', maxWidth: '100%' }}>
        <canvas ref={canvasRef} width={width} height={height} className="size-full" />
        <button type="button" onClick={playing ? pause : play} className="absolute inset-0 grid place-items-center" aria-label={playing ? 'Pause' : 'Play'}>
          {!playing && (
            <span className="grid size-16 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
              {ended ? <RotateCcw className="size-7" /> : <Play className="ml-1 size-8" fill="currentColor" />}
            </span>
          )}
        </button>
        {!mix && (
          <span className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 text-[11px] text-white">
            <Spinner className="size-3" /> Mixing audio
          </span>
        )}
      </div>
      <div className="flex w-full max-w-md items-center gap-3">
        <button type="button" onClick={playing ? pause : play} className="grid size-9 place-items-center rounded-full bg-surface-2" aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={timeline.duration}
          step={0.01}
          value={time}
          aria-label="Seek"
          onChange={(e) => seekTo(Number(e.target.value))}
          className="flex-1 accent-[var(--color-accent)]"
        />
        <span className="w-20 text-right text-xs tabular-nums text-muted">
          {formatDuration(time)} / {formatDuration(timeline.duration)}
        </span>
      </div>
      <div ref={holderRef} className="pointer-events-none fixed -left-[9999px] size-px overflow-hidden opacity-0" aria-hidden />
    </div>
  )
}

/** Keeps each clip's <video> at the right spot: playing for the current shot, parked at its in-point for the next one. */
function syncVideos(tl: Timeline, t: number, playing: boolean, videos: Map<string, HTMLVideoElement>) {
  const cur = shotAt(tl, t)
  if (!cur) return
  const want = new Map<string, { time: number; play: boolean }>()
  const curSrc = cur.shot.in + (t - cur.start)
  want.set(cur.clip.id, { time: curSrc, play: playing })
  if (cur.prev && t - cur.start < TRANSITION_SEC && cur.shot.transitionIn !== 'cut' && !want.has(cur.prev.clip.id)) {
    want.set(cur.prev.clip.id, { time: cur.prev.shot.out + (t - cur.start), play: playing })
  }
  const idx = tl.shots.indexOf(cur)
  const next = tl.shots[idx + 1]
  if (next && !want.has(next.clip.id)) want.set(next.clip.id, { time: next.shot.in, play: false })

  for (const [id, v] of videos) {
    const w = want.get(id)
    if (!w) {
      if (!v.paused) v.pause()
      continue
    }
    if (v.readyState < 1) continue
    const drift = Math.abs(v.currentTime - w.time)
    if (w.play) {
      if (v.paused) {
        v.currentTime = w.time
        void v.play().catch(() => {})
      } else if (drift > 0.25) v.currentTime = w.time
    } else {
      if (!v.paused) v.pause()
      if (drift > 0.04 && !v.seeking) v.currentTime = w.time
    }
  }
}
