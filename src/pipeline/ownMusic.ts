import { uid } from '@/domain/ids'
import { OWN_MUSIC } from '@/domain/types'
import { putMedia } from '@/lib/mediaStore'
import { decodeAudioFile } from '@/media/audio'
import { releaseMedia, useProject } from '@/store/projectStore'

const state = () => useProject.getState()

/** Uses a song the user uploaded (they've confirmed they have the rights) as the vlog's music. */
export async function addOwnMusic(file: File) {
  let durationSec: number
  try {
    durationSec = (await decodeAudioFile(file)).duration
  } catch {
    throw new Error('Couldn’t read that song. Try an MP3, M4A or WAV file.')
  }
  const previous = state().project?.ownMusic?.mediaKey
  const mediaKey = uid('m_')
  await putMedia(mediaKey, file)
  await state().updateProject({ ownMusic: { mediaKey, name: file.name.replace(/\.[^.]+$/, ''), durationSec, startSec: 0 }, musicTrackId: OWN_MUSIC })
  releaseMedia([previous])
}

export const setOwnMusicStart = (startSec: number) => state().updateProject((p) => ({ ownMusic: p.ownMusic && { ...p.ownMusic, startSec } }))

export async function removeOwnMusic() {
  const key = state().project?.ownMusic?.mediaKey
  await state().updateProject((p) => ({ ownMusic: undefined, musicTrackId: p.musicTrackId === OWN_MUSIC ? null : p.musicTrackId }))
  releaseMedia([key])
}
