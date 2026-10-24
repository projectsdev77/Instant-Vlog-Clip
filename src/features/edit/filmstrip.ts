import { useEffect, useState } from 'react'
import type { Clip } from '@/domain/types'
import { getMediaUrl } from '@/lib/mediaStore'

const cache = new Map<string, Promise<string[]>>()

/** Grabs `count` evenly spaced frames from a clip as small JPEGs (once per clip). */
function grabFrames(clip: Clip, count: number): Promise<string[]> {
  const key = `${clip.id}:${count}`
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      const url = await getMediaUrl(clip.mediaKey)
      if (!url) return []
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      v.preload = 'auto'
      v.src = url
      await new Promise<void>((ok, fail) => {
        v.onloadeddata = () => ok()
        v.onerror = () => fail(new Error('frame grab failed'))
      })
      const h = 112
      const w = Math.max(1, Math.round((h * v.videoWidth) / Math.max(1, v.videoHeight)))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      const out: string[] = []
      for (let i = 0; i < count; i++) {
        v.currentTime = Math.min(clip.durationSec - 0.05, ((i + 0.5) / count) * clip.durationSec)
        await new Promise<void>((ok) => (v.onseeked = () => ok()))
        ctx.drawImage(v, 0, 0, w, h)
        out.push(canvas.toDataURL('image/jpeg', 0.6))
      }
      v.removeAttribute('src')
      v.load()
      return out
    })().catch(() => [])
    cache.set(key, p)
  }
  return p
}

/** Frames for the trim filmstrip; the clip's thumbnail stands in until they're ready. */
export function useFilmstrip(clip: Clip | undefined, count = 10): string[] {
  const [frames, setFrames] = useState<{ id: string; urls: string[] } | null>(null)
  useEffect(() => {
    if (!clip) return
    let live = true
    void grabFrames(clip, count).then((urls) => live && setFrames({ id: clip.id, urls }))
    return () => {
      live = false
    }
  }, [clip, count])
  if (!clip) return []
  if (frames?.id === clip.id && frames.urls.length) return frames.urls
  return clip.thumbnail ? Array.from({ length: count }, () => clip.thumbnail!) : []
}
