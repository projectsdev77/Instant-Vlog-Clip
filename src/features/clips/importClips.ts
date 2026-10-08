import { uid } from '@/domain/ids'
import type { Clip } from '@/domain/types'
import { putMedia, requestPersistentStorage } from '@/lib/mediaStore'
import { analyzeLocally } from '@/media/analyzeLocal'
import { probeVideo, UnsupportedVideoError } from '@/media/input'
import { useProject } from '@/store/projectStore'
import { findDuplicates } from './duplicates'
import { isAcceptedFile, LIMITS } from './limits'

export type ImportReport = { added: number; rejected: string[] }

/**
 * Adds files to the open project: stores them on device, reads metadata,
 * then computes thumbnails/signals. Each clip becomes usable as soon as its
 * own processing finishes.
 */
export async function importFiles(files: File[]): Promise<ImportReport> {
  const store = useProject.getState()
  const project = store.project
  if (!project) return { added: 0, rejected: [] }
  void requestPersistentStorage()

  const rejected: string[] = []
  let count = store.clips.length
  let bytes = store.clips.reduce((a, c) => a + c.sizeBytes, 0)
  const accepted: Clip[] = []

  for (const file of files) {
    if (!isAcceptedFile(file)) {
      rejected.push(`${file.name}: not a supported video (MP4, MOV or WebM)`)
      continue
    }
    if (count >= LIMITS.maxClips) {
      rejected.push(`${file.name}: you can add up to ${LIMITS.maxClips} clips`)
      continue
    }
    if (bytes + file.size > LIMITS.maxTotalBytes) {
      rejected.push(`${file.name}: total size is over 4 GB`)
      continue
    }
    count++
    bytes += file.size
    const clip: Clip = {
      id: uid('c_'),
      projectId: project.id,
      fileName: file.name,
      mime: file.type || 'video/mp4',
      sizeBytes: file.size,
      mediaKey: uid('m_'),
      durationSec: 0,
      width: 0,
      height: 0,
      rotation: 0,
      hasAudio: false,
      addedAt: Date.now(),
      mustInclude: false,
      status: 'importing',
    }
    accepted.push(clip)
    await useProject.getState().addClip(clip)
    void putMedia(clip.mediaKey, file) // persisted in the background; processing uses the File directly
    processFile(clip, file, rejected)
  }
  return { added: accepted.length, rejected }
}

const queue: (() => Promise<void>)[] = []
let running = false

/** Decoding is heavy; process one clip at a time. */
function processFile(clip: Clip, file: Blob, rejected: string[]) {
  queue.push(() => processOne(clip, file, rejected))
  if (!running) void drain()
}

let idleWaiters: (() => void)[] = []

async function drain() {
  running = true
  while (queue.length) await queue.shift()!()
  running = false
  idleWaiters.forEach((r) => r())
  idleWaiters = []
}

/** Resolves when every queued clip has been read. */
export function waitForImports(): Promise<void> {
  return running || queue.length ? new Promise((r) => idleWaiters.push(r)) : Promise.resolve()
}

async function processOne(clip: Clip, file: Blob, rejected: string[]) {
  const { updateClip } = useProject.getState()
  try {
    const meta = await probeVideo(file)
    const totalSec = useProject.getState().clips.reduce((a, c) => a + (c.id === clip.id ? 0 : c.durationSec), 0)
    if (totalSec + meta.durationSec > LIMITS.maxTotalSec) {
      rejected.push(`${clip.fileName}: total footage is over 10 minutes`)
      await useProject.getState().removeClip(clip.id)
      return
    }
    await updateClip(clip.id, { ...meta })
    const local = await analyzeLocally(file, meta.durationSec, meta.hasAudio)
    await updateClip(clip.id, { thumbnail: local.thumbnail, signals: local.signals, contactSheet: local.contactSheet, status: 'ready' })
    await markDuplicates()
  } catch (e) {
    const msg = e instanceof UnsupportedVideoError ? e.message : `Couldn't read this video (${(e as Error).message})`
    await updateClip(clip.id, { status: 'error', error: msg })
  }
}

async function markDuplicates() {
  const { clips, updateClip } = useProject.getState()
  const dups = findDuplicates(clips)
  for (const c of clips) {
    const dupOf = dups.get(c.id)
    if (c.signals && c.signals.duplicateOf !== dupOf) await updateClip(c.id, { signals: { ...c.signals, duplicateOf: dupOf } })
  }
}

/** Re-runs processing for clips left unfinished (e.g. the tab was closed mid-import). */
export async function resumePending(getBlob: (key: string) => Promise<Blob | null>) {
  for (const c of useProject.getState().clips) {
    if (c.status === 'ready' && c.signals) continue
    if (c.status === 'analyzed' || c.status === 'error') continue
    const blob = await getBlob(c.mediaKey)
    if (blob) processFile(c, blob, [])
  }
}
