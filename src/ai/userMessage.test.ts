import { describe, expect, it, vi } from 'vitest'
import { forUsers, UNAVAILABLE } from './userMessage'

describe('forUsers', () => {
  it('keeps plain messages', () => {
    expect(forUsers('The AI voice is busy right now. Try again in a moment.')).toBe('The AI voice is busy right now. Try again in a moment.')
    expect(forUsers('You’ve used your free vlog. Sign in to make more.')).toBe('You’ve used your free vlog. Sign in to make more.')
  })
  it('hides anything about the setup', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const m of ['Voice service: ElevenLabs is busy.', 'GEMINI_API_KEY is not set', 'run supabase functions deploy ai', 'paused free-tier use', undefined])
      expect(forUsers(m)).toBe(UNAVAILABLE)
  })
})
