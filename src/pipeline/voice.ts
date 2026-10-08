import { ai } from '@/ai'
import { textHash, uid } from '@/domain/ids'
import type { LineAudio, Project, ScriptLine } from '@/domain/types'
import { hasFreshAudio } from '@/domain/timing'
import { deleteMedia, putMedia } from '@/lib/mediaStore'
import { decodeAudioFile } from '@/media/audio'
import { useProject } from '@/store/projectStore'
import { cleanUpRecording } from '@/features/voice/recorder'
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
          if (l.audio && l.audio.mediaKey !== audio.mediaKey) void deleteMedia(l.audio.mediaKey)
          return { ...l, audio }
        }),
      },
    }
  })
}

/** AI voice for one line. */
export async function voiceLine(line: ScriptLine, voiceId: string, language: string): Promise<void> {
  const { audio, words } = await ai.synthesize(line.text, voiceId, language)
  const durationSec = (await decodeAudioFile(audio)).duration
  const mediaKey = uid('vo_')
  await putMedia(mediaKey, audio)
  await setLineAudio(line.id, { mediaKey, durationSec, words, source: 'ai', voiceId, textHash: textHash(line.text) })
}

/** The user's own recording for one line: cleaned up, stored, word-timed. */
export async function saveRecording(line: ScriptLine, recording: Blob, language: string): Promise<void> {
  const { wav, durationSec } = await cleanUpRecording(recording)
  const mediaKey = uid('rec_')
  await putMedia(mediaKey, wav)
  let words: LineAudio['words'] = []
  try {
    words = (await ai.transcribe(wav, language, line.text)).words
  } catch {
    /* captions fall back to evenly spaced words */
  }
  await setLineAudio(line.id, { mediaKey, durationSec, words, source: 'recorded', textHash: textHash(line.text) })
}

/** Lines that still need AI voice (new, edited, or voiced with another voice). */
export function linesNeedingVoice(p: Project): ScriptLine[] {
  if (p.voice.mode !== 'ai' || !p.script) return []
  return p.script.lines.filter((l) => !hasFreshAudio(l) || l.audio?.source !== 'ai' || l.audio.voiceId !== p.voice.voiceId)
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
    3,
  )
}
