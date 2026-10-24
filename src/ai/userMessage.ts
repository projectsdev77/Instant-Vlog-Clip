export const UNAVAILABLE = 'The AI isn’t available right now. Please try again later.'

/** Server messages are written for users; this is a safety net so no setup detail (services, keys, commands) ever shows. */
export function forUsers(message: string | undefined): string {
  if (!message || /elevenlabs|gemini|anthropic|claude|supabase|openai|api[ _-]?key|secret|deploy|free[ -]tier|_KEY\b/i.test(message)) {
    if (message) console.error('AI error (hidden from the user):', message)
    return UNAVAILABLE
  }
  return message
}
