import { type Alignment, wordsFromAlignment } from '../_shared/alignment.ts'
import { ELEVENLABS_VOICE_IDS, type WordWire } from '../_shared/contracts.ts'

// Endpoints per the ElevenLabs API reference (text-to-speech "with timestamps"
// and speech-to-text "Scribe"). Verify model ids against current docs.
const BASE = 'https://api.elevenlabs.io/v1'
const TTS_MODEL = 'eleven_multilingual_v2'
const STT_MODEL = 'scribe_v1'

const key = () => {
  const k = Deno.env.get('ELEVENLABS_API_KEY')
  if (!k) throw new Error('ELEVENLABS_API_KEY is not set')
  return k
}

export async function synthesize(text: string, voiceId: string): Promise<{ audioBase64: string; mime: string; words: WordWire[] }> {
  const voice = ELEVENLABS_VOICE_IDS[voiceId] ?? voiceId
  const res = await fetch(`${BASE}/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: TTS_MODEL }),
  })
  if (!res.ok) throw new Error(`TTS failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { audio_base64: string; alignment?: Alignment; normalized_alignment?: Alignment }
  const a = body.alignment ?? body.normalized_alignment
  return { audioBase64: body.audio_base64, mime: 'audio/mpeg', words: a ? wordsFromAlignment(a) : [] }
}

export async function transcribe(audio: Uint8Array<ArrayBuffer>, mime: string, language: string): Promise<{ text: string; words: WordWire[] }> {
  const form = new FormData()
  form.append('file', new Blob([audio], { type: mime }), mime === 'audio/wav' ? 'audio.wav' : 'audio.webm')
  form.append('model_id', STT_MODEL)
  form.append('language_code', language)
  form.append('timestamps_granularity', 'word')
  form.append('tag_audio_events', 'false')
  const res = await fetch(`${BASE}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': key() }, body: form })
  if (!res.ok) throw new Error(`STT failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { text: string; words?: { text: string; start: number; end: number; type: string }[] }
  return {
    text: body.text,
    words: (body.words ?? []).filter((w) => w.type === 'word').map((w) => ({ word: w.text, start: w.start, end: w.end })),
  }
}
