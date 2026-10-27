import type { Clip } from '@/domain/types'
import { putMedia } from '@/lib/mediaStore'
import { useProject } from '@/store/projectStore'

/**
 * Picks the missing clip a chosen file belongs to: same name and size first,
 * then the only one with that name, then the only one with that size (a
 * renamed copy of the same file).
 */
export function matchClip(file: { name: string; size: number }, missing: Clip[]): Clip | undefined {
  const exact = missing.find((c) => c.fileName === file.name && c.sizeBytes === file.size)
  if (exact) return exact
  const byName = missing.filter((c) => c.fileName === file.name)
  if (byName.length === 1) return byName[0]
  const bySize = missing.filter((c) => c.sizeBytes === file.size)
  return bySize.length === 1 ? bySize[0] : undefined
}

/**
 * A draft opened from the account on another device knows its clips but not
 * their videos. The user adds the files again; each one that matches goes
 * back in its place, keeping everything the AI found in it.
 */
export async function relinkClips(files: File[]): Promise<{ matched: number; unmatched: string[] }> {
  const { clips, updateClip } = useProject.getState()
  const missing = clips.filter((c) => c.status === 'missing')
  const unmatched: string[] = []
  let matched = 0
  for (const file of files) {
    const clip = matchClip(file, missing)
    if (!clip) {
      unmatched.push(file.name)
      continue
    }
    await putMedia(clip.mediaKey, file)
    await updateClip(clip.id, { status: clip.analysis ? 'analyzed' : 'ready' })
    missing.splice(missing.indexOf(clip), 1)
    matched++
  }
  return { matched, unmatched }
}
