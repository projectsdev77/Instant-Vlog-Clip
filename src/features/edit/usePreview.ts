import { useEffect, useRef, useState } from 'react'
import { AiError, ai } from '@/ai'
import { toast } from '@/components/ui/Toast'
import { encodeWav } from '@/media/audio'
import { renderTrack } from '@/render/music'
import { trackById } from '@/render/musicTracks'

const cache = new Map<string, string>()

async function sampleUrl(key: string, make: () => Promise<Blob>): Promise<string> {
  let url = cache.get(key)
  if (!url) {
    url = URL.createObjectURL(await make())
    cache.set(key, url)
  }
  return url
}

/**
 * Short samples for the Voice and Music tabs: one plays at a time, a second
 * tap stops it. Voice samples read a line (ElevenLabs credits, so cached);
 * music samples are made on the device.
 */
export function usePreview() {
  const [playing, setPlaying] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => () => audio.current?.pause(), [])

  const play = async (id: string, make: () => Promise<string>) => {
    audio.current?.pause()
    if (playing === id) {
      setPlaying(null)
      return
    }
    setPlaying(null)
    setLoading(id)
    let url: string
    try {
      url = await make()
    } catch (e) {
      toast(e instanceof AiError ? e.message : 'Couldn’t play a preview.', 'error')
      return
    } finally {
      setLoading(null)
    }
    const el = new Audio(url)
    audio.current = el
    el.onended = () => setPlaying(null)
    setPlaying(id)
    void el.play()
  }

  return {
    playing,
    loading,
    voice: (voiceId: string, text: string, language: string) =>
      play(`voice:${voiceId}`, () => sampleUrl(`voice:${voiceId}:${text}`, async () => (await ai.synthesize(text, voiceId, language)).audio)),
    music: (trackId: string) =>
      play(`music:${trackId}`, () =>
        sampleUrl(`music:${trackId}`, async () => {
          const track = trackById(trackId)
          if (!track) throw new Error('No such track')
          return encodeWav(await renderTrack(track, 8, 44100))
        }),
      ),
  }
}
