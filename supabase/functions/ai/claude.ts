import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'
import { forClaude } from '../_shared/schemas.ts'
import { type JsonRequest, RateLimitError, RefusalError } from './llm.ts'

const MODEL = 'claude-opus-5-5'

let client: Anthropic | null = null
const getClient = () => (client ??= new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') }))

/**
 * One structured-output call. The system prompt is cached (it's identical on
 * every request); refusals fall back server-side to the recommended model.
 */
export async function claudeJson<T>(req: JsonRequest): Promise<T> {
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = req.parts.map((p) =>
    p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image', source: { type: 'base64', media_type: p.mimeType, data: p.base64 } },
  )
  let message
  try {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: req.maxTokens ?? 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: req.effort, format: { type: 'json_schema', schema: forClaude(req.schema) } },
      messages: [{ role: 'user', content }],
    })
    message = await stream.finalMessage()
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new RateLimitError('The AI is busy right now. Try again in a minute.')
    throw e
  }
  if (message.stop_reason === 'refusal') throw new RefusalError('The AI declined this request')
  if (message.stop_reason === 'max_tokens') throw new Error('AI response was cut off')
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  return JSON.parse(text) as T
}
