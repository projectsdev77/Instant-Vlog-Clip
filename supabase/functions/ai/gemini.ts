import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel, type ThinkingConfig } from 'npm:@google/genai@2.23.0'
import { forGemini } from '../_shared/schemas.ts'
import { type JsonRequest, RateLimitError, RefusalError } from './llm.ts'

// "gemini-flash-latest" follows Google's current Flash model, the one with a
// free tier. Set GEMINI_MODEL to pin a specific version (e.g. for launch).
const model = () => Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest'

let client: GoogleGenAI | null = null
const getClient = () => {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return (client ??= new GoogleGenAI({ apiKey }))
}

/**
 * How much the model may think. Left alone, Flash models think at length, which
 * made quick jobs (polish, clip checks) take a minute. Newer models take a
 * thinking level; older ones a token budget, used if the level is refused.
 */
const LEVEL: Record<JsonRequest['effort'], ThinkingLevel | undefined> = { low: ThinkingLevel.MINIMAL, medium: ThinkingLevel.LOW, high: undefined }
const BUDGET: Record<JsonRequest['effort'], number | undefined> = { low: 0, medium: 1024, high: undefined }
let thinkingByBudget = false

function thinking(effort: JsonRequest['effort']): ThinkingConfig | undefined {
  if (thinkingByBudget) return BUDGET[effort] === undefined ? undefined : { thinkingBudget: BUDGET[effort] }
  return LEVEL[effort] ? { thinkingLevel: LEVEL[effort] } : undefined
}

export async function geminiJson<T>(req: JsonRequest): Promise<T> {
  const started = Date.now()
  const send = () =>
    getClient().models.generateContent({
      model: model(),
      contents: [
        {
          role: 'user',
          parts: [
            ...req.parts.map((p) => (p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mimeType, data: p.base64 } })),
            ...(req.checklist ? [{ text: req.checklist }] : []),
          ],
        },
      ],
      config: {
        systemInstruction: req.system,
        responseMimeType: 'application/json',
        responseJsonSchema: forGemini(req.schema),
        maxOutputTokens: req.maxTokens ?? 32000,
        thinkingConfig: thinking(req.effort),
      },
    })
  let res
  try {
    try {
      res = await send()
    } catch (e) {
      // Older models don't know thinking levels: switch to token budgets and retry once.
      if (e instanceof ApiError && e.status === 400 && /thinking/i.test(e.message) && !thinkingByBudget) {
        thinkingByBudget = true
        res = await send()
      } else throw e
    }
  } catch (e) {
    console.error(`gemini ${model()} failed after ${Date.now() - started} ms`)
    if (e instanceof ApiError && e.status === 429) throw new RateLimitError('The AI is busy right now (usage limit reached). Try again in a minute.')
    throw e
  }
  console.log(`gemini ${model()} effort=${req.effort} ${Date.now() - started} ms`)
  if (res.promptFeedback?.blockReason) throw new RefusalError('The AI declined this request')
  const finish = res.candidates?.[0]?.finishReason
  if (finish === FinishReason.SAFETY) throw new RefusalError('The AI declined this request')
  if (finish === FinishReason.MAX_TOKENS) throw new Error('AI response was cut off')
  const text = res.text
  if (!text) throw new Error('AI returned an empty response')
  return JSON.parse(text) as T
}
