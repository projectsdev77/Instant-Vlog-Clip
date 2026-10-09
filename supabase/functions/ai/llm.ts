// Provider-neutral "ask for JSON" used by every AI action. Pick the provider
// with the AI_PROVIDER secret: "gemini" (default) or "claude".

export type Part = { type: 'text'; text: string } | { type: 'image'; mimeType: 'image/jpeg' | 'image/png'; base64: string }

export type JsonRequest = {
  system: string
  parts: Part[]
  /** JSON Schema of the answer */
  schema: Record<string, unknown>
  /** how hard the model should think; providers map this their own way */
  effort: 'low' | 'medium' | 'high'
  maxTokens?: number
  /** rules restated right before the model answers; sent to Gemini only */
  checklist?: string
}

/** The model declined for safety reasons. */
export class RefusalError extends Error {}
/** The provider's rate limit or quota was hit (common on free plans). */
export class RateLimitError extends Error {}

export type Provider = 'gemini' | 'claude'

export function currentProvider(): Provider {
  return Deno.env.get('AI_PROVIDER') === 'claude' ? 'claude' : 'gemini'
}

export async function generateJson<T>(req: JsonRequest): Promise<T> {
  if (currentProvider() === 'claude') {
    const { claudeJson } = await import('./claude.ts')
    return await claudeJson<T>(req)
  }
  const { geminiJson } = await import('./gemini.ts')
  return await geminiJson<T>(req)
}
