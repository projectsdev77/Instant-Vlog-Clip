/**
 * Sample clips for trying the app without your own footage: the three short
 * example videos from the home page (Mixkit free stock, see README).
 * File names describe the footage.
 */
const SAMPLES = [
  { file: 'cafe', name: 'morning-coffee' },
  { file: 'lake', name: 'lake-sunset' },
  { file: 'friends', name: 'campfire-night' },
]

export const SAMPLE_PROMPT = 'a weekend with friends'
export const SAMPLE_TITLE = 'Weekend with friends'

function pickFormat(): 'webm' | 'mp4' {
  if (typeof document === 'undefined') return 'mp4'
  const v = document.createElement('video')
  // Safari plays MP4 (H.264) everywhere; Chrome/Firefox decode VP9 WebM reliably.
  return v.canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'mp4'
}

export async function loadSampleFiles(): Promise<File[]> {
  const ext = pickFormat()
  return Promise.all(
    SAMPLES.map(async (s) => {
      const res = await fetch(`/examples/${s.file}.${ext}`)
      if (!res.ok) throw new Error("Couldn't load the sample clips. Check your connection and try again.")
      const blob = await res.blob()
      return new File([blob], `${s.name}.${ext}`, { type: `video/${ext}`, lastModified: Date.now() })
    }),
  )
}
