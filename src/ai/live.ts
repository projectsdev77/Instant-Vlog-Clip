import type { AiAction, AiErrorBody, PlanResponse, ScriptResponse, SynthesizeResponse, TranscribeResponse, AnalyzeClipResponse } from '@shared/contracts.ts'
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase'
import { analysisFromWire } from './catalog'
import { AiError, type AiService } from './service'
import { guestId } from './guest'

/** How long each AI action may take before we give up (the model can be slow, especially on free plans). */
const TIMEOUT_MS: Record<AiAction['action'], number> = {
  'analyze-clip': 60_000,
  'write-script': 90_000,
  'plan-edit': 120_000,
  synthesize: 45_000,
  transcribe: 60_000,
}

async function call<T>(body: AiAction, attempt = 0): Promise<T> {
  if (!supabaseUrl || !supabaseAnonKey) throw new AiError('AI is not configured (missing Supabase settings).', 'auth')
  const session = (await supabase?.auth.getSession())?.data.session
  let res: Response
  const timeout = AbortSignal.timeout(TIMEOUT_MS[body.action])
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/ai`, {
      signal: timeout,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: supabaseAnonKey,
        authorization: `Bearer ${session?.access_token ?? supabaseAnonKey}`,
        'x-guest-id': guestId(),
      },
      body: JSON.stringify(body),
    })
  } catch {
    if (timeout.aborted) throw new AiError('The AI took too long to answer. Please try again.', 'upstream')
    if (attempt < 1) return call(body, attempt + 1)
    throw new AiError("Can't reach the AI service. Check your connection.", 'network')
  }
  if (res.ok) return (await res.json()) as T
  const err = (await res.json().catch(() => ({ code: 'upstream', error: res.statusText }))) as AiErrorBody
  if (err.code === 'upstream' && attempt < 1) return call(body, attempt + 1)
  throw new AiError(err.error, err.code)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export const liveAi: AiService = {
  async analyzeClip(req) {
    const r = await call<AnalyzeClipResponse>({ action: 'analyze-clip', payload: req })
    return analysisFromWire(r, req.durationSec)
  },
  writeScript: (req) => call<ScriptResponse>({ action: 'write-script', payload: req }),
  planEdit: (req) => call<PlanResponse>({ action: 'plan-edit', payload: req }),
  async synthesize(text, voiceId, language) {
    const r = await call<SynthesizeResponse>({ action: 'synthesize', payload: { text, voiceId, language } })
    return { audio: base64ToBlob(r.audioBase64, r.mime), words: r.words }
  },
  async transcribe(audio, language) {
    return await call<TranscribeResponse>({ action: 'transcribe', payload: { audioBase64: await blobToBase64(audio), mime: audio.type || 'audio/wav', language } })
  },
}
