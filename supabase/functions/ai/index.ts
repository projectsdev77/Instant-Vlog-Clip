// The app's single AI endpoint. Keeps API keys server-side; receives only
// contact sheets, short audio and text, never the user's video files.
import type {
  AiAction,
  AiErrorBody,
  AnalyzeClipResponse,
  PlanResponse,
  ScriptResponse,
} from '../_shared/contracts.ts'
import { ANALYZE_SYSTEM, analyzeUserText, PLAN_SYSTEM, planUserText, SCRIPT_SYSTEM, scriptUserText } from '../_shared/prompts.ts'
import { analyzeClipSchema, planSchema, scriptSchema } from '../_shared/schemas.ts'
import { claudeJson, RefusalError } from './claude.ts'
import { synthesize, transcribe } from './elevenlabs.ts'
import { authorize, QuotaError, AuthError, type UsageKind } from './quota.ts'

const CORS = {
  'access-control-allow-origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-guest-id',
  'access-control-allow-methods': 'POST, OPTIONS',
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
      return await claudeJson<AnalyzeClipResponse>({
        system: ANALYZE_SYSTEM,
        effort: 'low',
        schema: analyzeClipSchema,
        maxTokens: 8000,
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.contactSheetBase64 } },
          { type: 'text', text: analyzeUserText(p) },
        ],
      })
    }
    case 'write-script':
      return await claudeJson<ScriptResponse>({
        system: SCRIPT_SYSTEM,
        effort: 'medium',
        schema: scriptSchema,
        content: [{ type: 'text', text: scriptUserText(req.payload) }],
      })
    case 'plan-edit':
      return await claudeJson<PlanResponse>({
        system: PLAN_SYSTEM,
        effort: 'medium',
        schema: planSchema,
        content: [{ type: 'text', text: planUserText(req.payload) }],
      })
    case 'synthesize':
      return await synthesize(req.payload.text, req.payload.voiceId)
    case 'transcribe':
      return await transcribe(b64ToBytes(req.payload.audioBase64), req.payload.mime, req.payload.language)
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
    await authorize(request, usageKind(body))
    return json(await handle(body))
  } catch (e) {
    if (e instanceof AuthError) return fail('auth', e.message, 401)
    if (e instanceof QuotaError) return fail('quota', e.message, 429)
    if (e instanceof RefusalError) return fail('refusal', e.message, 422)
    console.error(body.action, e)
    return fail('upstream', 'The AI service had a problem. Please try again.', 502)
  }
})
