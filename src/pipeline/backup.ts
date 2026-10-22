import { uid } from '@/domain/ids'
import type { Clip, Project } from '@/domain/types'
import { db } from '@/lib/db'
import { getMedia, putMedia } from '@/lib/mediaStore'
import { mediaInUse } from '@/store/projectStore'

/**
 * A backup is one file: a short header, a JSON manifest (the project with its
 * versions, its clips) and then every stored file it uses, back to back
 * (videos, AI voice, recorded takes). Restoring reads each file as a slice, so
 * large clips are never all in memory at once.
 */
const MAGIC = 'IVCBACKUP1'
const HEAD = MAGIC.length + 4

type Manifest = { format: 'instant-vlog-clip'; version: 1; project: Project; clips: Clip[]; media: { key: string; type: string; size: number }[] }

export async function backupProject(id: string): Promise<{ blob: Blob; fileName: string }> {
  const project = await db.projects.get(id)
  if (!project) throw new Error('This vlog is no longer on this device.')
  const clips = await db.clips.where('projectId').equals(id).toArray()
  const keys = [...new Set([...clips.map((c) => c.mediaKey), ...mediaInUse(project)])]
  const media: Manifest['media'] = []
  const parts: Blob[] = []
  for (const key of keys) {
    const blob = await getMedia(key)
    if (!blob) continue
    media.push({ key, type: blob.type, size: blob.size })
    parts.push(blob)
  }
  const manifest = new TextEncoder().encode(JSON.stringify({ format: 'instant-vlog-clip', version: 1, project, clips, media } satisfies Manifest))
  const head = new Uint8Array(HEAD)
  head.set(new TextEncoder().encode(MAGIC))
  new DataView(head.buffer).setUint32(MAGIC.length, manifest.length)
  const name = (project.title || 'vlog').replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'vlog'
  return { blob: new Blob([head, manifest, ...parts], { type: 'application/octet-stream' }), fileName: `${name}.vlogbackup` }
}

/** Adds the vlog in a backup file to this device as a new project (fresh ids, so it never clashes). */
export async function restoreProject(file: Blob): Promise<Project> {
  const head = new Uint8Array(await file.slice(0, HEAD).arrayBuffer())
  if (new TextDecoder().decode(head.slice(0, MAGIC.length)) !== MAGIC) throw new Error('That isn’t an Instant Vlog Clip backup.')
  const length = new DataView(head.buffer).getUint32(MAGIC.length)
  let manifest: Manifest
  try {
    manifest = JSON.parse(await file.slice(HEAD, HEAD + length).text()) as Manifest
  } catch {
    throw new Error('This backup file is damaged.')
  }
  if (manifest.format !== 'instant-vlog-clip' || manifest.version !== 1) throw new Error('This backup was made by a newer version of the app.')

  // New ids for the project, its clips and its files; every reference follows (ids are long random strings).
  const ids = new Map<string, string>([[manifest.project.id, uid('p_')]])
  for (const c of manifest.clips) ids.set(c.id, uid('c_'))
  for (const m of manifest.media) ids.set(m.key, uid('m_'))
  let json = JSON.stringify({ project: manifest.project, clips: manifest.clips })
  for (const [from, to] of ids) json = json.split(from).join(to)
  const { project, clips } = JSON.parse(json) as { project: Project; clips: Clip[] }

  let offset = HEAD + length
  for (const m of manifest.media) {
    await putMedia(ids.get(m.key)!, file.slice(offset, offset + m.size, m.type))
    offset += m.size
  }
  const restored: Project = { ...project, updatedAt: Date.now() }
  await db.clips.bulkPut(clips)
  await db.projects.put(restored)
  return restored
}
