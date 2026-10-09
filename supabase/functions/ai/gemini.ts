import { ApiError, FinishReason, GoogleGenAI } from 'npm:@google/genai@2.23.0'
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

export async function geminiJson<T>(req: JsonRequest): Promise<T> {
  let res
  try {
    res = await getClient().models.generateContent({
      model: model(),
      contents: [
        {
          role: 'user',
          parts: req.parts.map((p) => (p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mimeType, data: p.base64 } })),
        },
      ],
      config: {
        systemInstruction: req.system,
        responseMimeType: 'application/json',
        responseJsonSchema: req.schema,
        maxOutputTokens: req.maxTokens ?? 32000,
      },
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) throw new RateLimitError('The AI is busy right now (usage limit reached). Try again in a minute.')
    throw e
  }
  if (res.promptFeedback?.blockReason) throw new RefusalError('The AI declined this request')
  const finish = res.candidates?.[0]?.finishReason
  if (finish === FinishReason.SAFETY) throw new RefusalError('The AI declined this request')
  if (finish === FinishReason.MAX_TOKENS) throw new Error('AI response was cut off')
  const text = res.text
  if (!text) throw new Error('AI returned an empty response')
  return JSON.parse(text) as T
}
