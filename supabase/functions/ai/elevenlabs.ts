import { type Alignment, wordsFromAlignment } from '../_shared/alignment.ts'
import { ELEVENLABS_VOICE_IDS, type WordWire } from '../_shared/contracts.ts'

// Endpoints per the ElevenLabs API reference (text-to-speech "with timestamps"
// and speech-to-text "Scribe"). Verify model ids against current docs.
const BASE = 'https://api.elevenlabs.io/v1'
const TTS_MODEL = 'eleven_multilingual_v2'
const STT_MODEL = 'scribe_v1'

/** An ElevenLabs failure with a message that says what to fix. */
export class VoiceServiceError extends Error {}

const key = () => {
  const k = Deno.env.get('ELEVENLABS_API_KEY')
  if (!k) throw new VoiceServiceError('Voice service: ELEVENLABS_API_KEY is not set in the Supabase secrets.')
  return k
}

/** Turns an ElevenLabs error response into a readable message (logs the raw one). */
async function failure(what: string, res: Response): Promise<VoiceServiceError> {
  const raw = await res.text()
  console.error(`ElevenLabs ${what} ${res.status}: ${raw}`)
  let detail = ''
  try {
    const d = (JSON.parse(raw) as { detail?: unknown }).detail
    detail = typeof d === 'string' ? d : JSON.stringify(d ?? '')
  } catch {
    detail = raw
  }
  const has = (s: string) => detail.toLowerCase().includes(s)
  let msg: string
  if (has('unusual_activity') || has('unusual activity')) msg = 'ElevenLabs paused free-tier use from this server. A paid ElevenLabs plan (Starter) fixes this.'
  else if (has('missing_permissions')) msg = `Your ElevenLabs API key doesn't allow ${what}. Edit the key in ElevenLabs and turn that permission on.`
  else if (res.status === 401) msg = 'ElevenLabs rejected the API key. Check ELEVENLABS_API_KEY in the Supabase secrets.'
  else if (res.status === 402 || has('paid_plan_required') || has('payment_required')) msg = 'This voice needs a paid ElevenLabs plan.'
  else if (has('quota_exceeded')) msg = 'The ElevenLabs credits for this month are used up.'
  else if (has('voice_not_found') || res.status === 404) msg = "ElevenLabs couldn't find this voice on your account."
  else if (res.status === 429) msg = 'ElevenLabs is busy. Try again in a moment.'
  else msg = `ElevenLabs ${what} failed (${res.status}). Please try again.`
  return new VoiceServiceError(`Voice service: ${msg}`)
}

export async function synthesize(text: string, voiceId: string): Promise<{ audioBase64: string; mime: string; words: WordWire[] }> {
  const voice = ELEVENLABS_VOICE_IDS[voiceId] ?? voiceId
  const res = await fetch(`${BASE}/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: TTS_MODEL }),
  })
  if (!res.ok) throw await failure('text to speech', res)
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
  if (!res.ok) throw await failure('speech to text', res)
  const body = (await res.json()) as { text: string; words?: { text: string; start: number; end: number; type: string }[] }
  return {
    text: body.text,
    words: (body.words ?? []).filter((w) => w.type === 'word').map((w) => ({ word: w.text, start: w.start, end: w.end })),
  }
}
