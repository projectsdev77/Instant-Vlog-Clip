import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'

const MODEL = 'claude-opus-5-5'

let client: Anthropic | null = null
const getClient = () => (client ??= new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') }))

export class RefusalError extends Error {}

type Content = Anthropic.Beta.Messages.BetaContentBlockParam[]

/**
 * One structured-output call. The system prompt is cached (it's identical on
 * every request); refusals fall back server-side to the recommended model.
 */
export async function claudeJson<T>(opts: {
  system: string
  content: Content
  schema: Record<string, unknown>
  effort: 'low' | 'medium' | 'high'
  maxTokens?: number
}): Promise<T> {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: opts.effort, format: { type: 'json_schema', schema: opts.schema } },
    messages: [{ role: 'user', content: opts.content }],
  })
  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') throw new RefusalError('The AI declined this request')
  if (message.stop_reason === 'max_tokens') throw new Error('AI response was cut off')
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  return JSON.parse(text) as T
}

export { Anthropic }
