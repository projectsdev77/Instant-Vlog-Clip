import { ai } from '@/ai'
import { textHash, uid } from '@/domain/ids'
import type { LineAudio, Project, ScriptLine } from '@/domain/types'
import { hasFreshAudio } from '@/domain/timing'
import { putMedia } from '@/lib/mediaStore'
import { decodeAudioFile } from '@/media/audio'
import { useProject } from '@/store/projectStore'
import { runLimited } from './analysis'

async function setLineAudio(lineId: string, audio: LineAudio) {
  const { updateProject } = useProject.getState()
  await updateProject((p) => {
    if (!p.script) return {}
    return {
      script: {
        ...p.script,
        lines: p.script.lines.map((l) => {
          if (l.id !== lineId) return l
          return { ...l, audio }
        }),
      },
    }
  })
}

/** AI voice for one line. */
export async function voiceLine(line: ScriptLine, voiceId: string, language: string): Promise<void> {
  const { delivery, seed } = line
  const { audio, words } = await ai.synthesize(line.text, voiceId, language, { delivery, seed })
  const durationSec = (await decodeAudioFile(audio)).duration
  const mediaKey = uid('vo_')
  await putMedia(mediaKey, audio)
  await setLineAudio(line.id, { mediaKey, durationSec, words, source: 'ai', voiceId, delivery, seed, textHash: textHash(line.text) })
}

/** Lines that still need AI voice (new, edited, or voiced with another voice or delivery). Muted lines never do. */
export function linesNeedingVoice(p: Project): ScriptLine[] {
  if (p.voice.mode !== 'ai' || !p.script) return []
  return p.script.lines.filter(
    (l) => !l.muted && (!hasFreshAudio(l) || l.audio?.source !== 'ai' || l.audio.voiceId !== p.voice.voiceId || l.audio.delivery !== l.delivery || l.audio.seed !== l.seed),
  )
}

export async function voiceAllLines(onProgress?: (done: number, total: number) => void): Promise<void> {
  const p = useProject.getState().project
  if (!p) return
  const todo = linesNeedingVoice(p)
  let done = 0
  onProgress?.(0, todo.length)
  await runLimited(
    todo.map((l) => async () => {
      await voiceLine(l, p.voice.voiceId, p.settings.language)
      onProgress?.(++done, todo.length)
    }),
    // ElevenLabs limits requests at once per plan (2 on the free plan); more get turned away as busy.
    2,
  )
}
