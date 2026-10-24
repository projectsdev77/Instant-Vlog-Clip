// The app's single AI endpoint. Keeps API keys server-side; receives only
// contact sheets, short audio and text, never the user's video files.
// The language model is Gemini or Claude (AI_PROVIDER); voice is ElevenLabs.
import { AI_FUNCTION_VERSION } from '../_shared/contracts.ts'
import type {
  AiAction,
  PolishResponse,
  AiErrorBody,
  AnalyzeClipResponse,
  PlanResponse,
  ScriptResponse,
} from '../_shared/contracts.ts'
import {
  ANALYZE_SYSTEM,
  analyzeChecklist,
  analyzeUserText,
  PLAN_SYSTEM,
  POLISH_SYSTEM,
  polishChecklist,
  polishUserText,
  planChecklist,
  planUserText,
  SCRIPT_SYSTEM,
  scriptChecklist,
  scriptUserText,
} from '../_shared/prompts.ts'
import { analyzeClipSchema, planSchema, polishSchema, scriptSchema } from '../_shared/schemas.ts'
import { generateJson, RateLimitError, RefusalError } from './llm.ts'
import { listVoices, synthesize, transcribe, VoiceServiceError } from './elevenlabs.ts'
import { authorize, QuotaError, AuthError, SetupError, type UsageKind } from './quota.ts'

const CORS = {
  'access-control-allow-origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-guest-id',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-expose-headers': 'x-ai-version',
  'x-ai-version': AI_FUNCTION_VERSION,
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })
const fail = (code: AiErrorBody['code'], error: string, status: number) => json({ code, error } satisfies AiErrorBody, status)

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function handle(req: AiAction) {
  switch (req.action) {
    case 'analyze-clip': {
      const p = req.payload
      return await generateJson<AnalyzeClipResponse>({
        system: ANALYZE_SYSTEM,
        effort: 'low',
        schema: analyzeClipSchema,
        maxTokens: 8000,
        checklist: analyzeChecklist(p),
        parts: [
          { type: 'image', mimeType: 'image/jpeg', base64: p.contactSheetBase64 },
          { type: 'text', text: analyzeUserText(p) },
        ],
      })
    }
    case 'write-script':
      return await generateJson<ScriptResponse>({
        system: SCRIPT_SYSTEM,
        effort: 'medium',
        schema: scriptSchema,
        checklist: scriptChecklist(req.payload),
        parts: [{ type: 'text', text: scriptUserText(req.payload) }],
      })
    case 'polish-lines': {
      const input = req.payload.lines
      const res = await generateJson<PolishResponse>({
        system: POLISH_SYSTEM,
        effort: 'low',
        schema: polishSchema,
        maxTokens: 4000,
        checklist: polishChecklist(req.payload),
        parts: [{ type: 'text', text: polishUserText(req.payload) }],
      })
      // Always one line per input line; anything missing keeps the user's original.
      const lines = input.map((l, i) => (typeof res.lines?.[i] === 'string' && res.lines[i].trim() ? res.lines[i].trim() : l))
      console.log(`polish-lines: ${input.length} in, ${lines.filter((l, i) => l !== input[i]).length} changed`)
      return { lines } satisfies PolishResponse
    }
    case 'plan-edit':
      return await generateJson<PlanResponse>({
        system: PLAN_SYSTEM,
        effort: 'medium',
        schema: planSchema,
        checklist: planChecklist(req.payload),
        parts: [{ type: 'text', text: planUserText(req.payload) }],
      })
    case 'synthesize':
      return await synthesize(req.payload.text, req.payload.voiceId, req.payload.delivery, req.payload.seed)
    case 'transcribe':
      return await transcribe(b64ToBytes(req.payload.audioBase64), req.payload.mime, req.payload.language)
    case 'list-voices':
      return await listVoices()
  }
}

/**
 * Users are limited per vlog: the first plan of an edit counts as a generation,
 * "Tell the AI" changes count as revisions, everything else as plain calls.
 */
function usageKind(body: AiAction): UsageKind {
  if (body.action !== 'plan-edit') return 'call'
  if (body.payload.feedback) return 'revision'
  return body.payload.previousIssues?.length ? 'call' : 'generation'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return fail('bad_request', 'POST only', 405)
  let body: AiAction
  try {
    body = await request.json()
  } catch {
    return fail('bad_request', 'Invalid JSON', 400)
  }
  try {
    // The voice list is free to fetch and holds nothing private, so it skips sign-in and limits.
    if (body.action === 'list-voices') return json(await listVoices())
    await authorize(request, usageKind(body))
    return json(await handle(body))
  } catch (e) {
    if (e instanceof AuthError) return fail('auth', e.message, 401)
    if (e instanceof QuotaError) return fail('quota', e.message, 429)
    if (e instanceof RefusalError) return fail('refusal', e.message, 422)
    if (e instanceof RateLimitError) return fail('upstream', e.message, 503)
    if (e instanceof SetupError) return fail('upstream', e.message, 500)
    if (e instanceof VoiceServiceError) return fail('upstream', e.message, 502)
    console.error(body.action, e)
    return fail('upstream', 'The AI service had a problem. Please try again.', 502)
  }
})
