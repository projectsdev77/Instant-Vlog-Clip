import { useEffect } from 'react'
import { create } from 'zustand'
import { VOICES, type VoiceOption } from '@shared/contracts.ts'
import { ai } from './index'

type VoicesState = { voices: VoiceOption[]; loaded: boolean }

/** The voices to offer: the built-in list until the server says which voices the ElevenLabs account has. */
export const useVoices = create<VoicesState>(() => ({ voices: VOICES, loaded: false }))

let loading: Promise<void> | undefined
/** Fetches the voice list once per visit; on any failure the built-in voices stay. */
export function loadVoices(): Promise<void> {
  loading ??= ai
    .listVoices()
    .then((voices) => {
      if (voices.length) useVoices.setState({ voices })
    })
    .catch((e) => console.warn('Using the built-in voices:', e))
    .finally(() => useVoices.setState({ loaded: true }))
  return loading
}

/** The voice list for a component, fetching it on first use. */
export function useVoiceList(): VoiceOption[] {
  useEffect(() => void loadVoices(), [])
  return useVoices((s) => s.voices)
}
