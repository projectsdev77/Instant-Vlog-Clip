import { AI_FUNCTION_VERSION } from '@shared/contracts.ts'
import type { AiAction, AiErrorBody, PolishResponse, PlanResponse, ScriptResponse, SynthesizeResponse, TranscribeResponse, AnalyzeClipResponse } from '@shared/contracts.ts'
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase'
import { analysisFromWire } from './catalog'
import { AiError, type AiService } from './service'
import { guestId } from './guest'

/** How long each AI action may take before we give up (the model can be slow, especially on free plans). */
const TIMEOUT_MS: Record<AiAction['action'], number> = {
  'analyze-clip': 60_000,
  'write-script': 90_000,
  'polish-lines': 60_000,
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
  checkVersion(res)
  if (res.ok) {
    try {
      return (await res.json()) as T
    } catch {
      // An older deployed function answers actions it doesn't know with an empty body.
      throw new AiError('The AI function sent an empty reply. It is probably out of date: run supabase functions deploy ai', 'upstream')
    }
  }
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

let versionWarned = false
/** Tells the developer when the deployed AI function is older than this app expects. */
function checkVersion(res: Response) {
  const v = res.headers.get('x-ai-version')
  if (v === AI_FUNCTION_VERSION || versionWarned) return
  versionWarned = true
  const msg = `The AI function on Supabase is out of date (deployed: ${v ?? 'older version'}, app expects ${AI_FUNCTION_VERSION}). Run: supabase functions deploy ai`
  console.warn(msg)
  if (import.meta.env.DEV) void import('@/components/ui/Toast').then(({ toast }) => toast(msg, 'error'))
}

export const liveAi: AiService = {
  async analyzeClip(req) {
    const r = await call<AnalyzeClipResponse>({ action: 'analyze-clip', payload: req })
    return analysisFromWire(r, req.durationSec)
  },
  writeScript: (req) => call<ScriptResponse>({ action: 'write-script', payload: req }),
  async polishLines(lines, language) {
    const r = await call<PolishResponse>({ action: 'polish-lines', payload: { lines, language } })
    if (!Array.isArray(r.lines)) throw new AiError('The AI function is out of date. Redeploy it with: supabase functions deploy ai', 'upstream')
    return lines.map((l, i) => r.lines[i] ?? l)
  },
  planEdit: (req) => call<PlanResponse>({ action: 'plan-edit', payload: req }),
  async synthesize(text, voiceId, language) {
    const r = await call<SynthesizeResponse>({ action: 'synthesize', payload: { text, voiceId, language } })
    return { audio: base64ToBlob(r.audioBase64, r.mime), words: r.words }
  },
  async transcribe(audio, language) {
    return await call<TranscribeResponse>({ action: 'transcribe', payload: { audioBase64: await blobToBase64(audio), mime: audio.type || 'audio/wav', language } })
  },
}
