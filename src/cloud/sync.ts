// Saving vlogs to the signed-in user's account and bringing them back on
// another device. The draft goes to the `vlogs` table; voice audio, the
// user's own song and the latest finished video go to storage. Original
// clips never leave the device: on a new device they're added again.
import type { Clip, Project } from '@/domain/types'
import { db } from '@/lib/db'
import { getMedia, putMedia } from '@/lib/mediaStore'
import { mediaInUse, useProject } from '@/store/projectStore'
import { supabaseBackend, type CloudBackend, type CloudRow } from './backend'
import { mergeClips, mergeProjects, toDraft, type CloudDraft } from './draft'

let backend: CloudBackend = supabaseBackend
/** Tests swap in an in-memory account. */
export const useBackend = (b: CloudBackend) => {
  backend = b
}

const folder = (uid: string, id: string) => `${uid}/${id}`
const mediaPath = (uid: string, id: string, key: string) => `${uid}/${id}/media/${key}`
const videoPath = (uid: string, id: string) => `${uid}/${id}/video.mp4`

/** The account has no room for this file. */
export class SpaceFull extends Error {}

// One account operation at a time per vlog, so a save never races a load.
const queues = new Map<string, Promise<unknown>>()
function queued<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const run = (queues.get(id) ?? Promise.resolve()).catch(() => {}).then(fn)
  queues.set(id, run)
  return run
}

/** Vlogs this signed-in user may sync: theirs, or ones made here before signing in. */
export const isMine = (p: Project, uid: string) => !p.ownerId || p.ownerId === uid

/** The open project's in-memory copy follows the database (owner, merged changes). */
async function refreshOpen(id: string) {
  if (useProject.getState().project?.id !== id) return
  const project = (await db.projects.get(id)) ?? null
  const clips = await db.clips.where('projectId').equals(id).toArray()
  const order = new Map(project?.clipIds.map((c, i) => [c, i]))
  clips.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  useProject.setState({ project, clips })
}

function coverOf(project: Project, clips: Clip[]): string | null {
  const edit = project.edits[project.currentEdit]
  const id = edit?.scenes[0]?.shots[0]?.clipId ?? project.clipIds[0]
  return clips.find((c) => c.id === id)?.thumbnail ?? null
}

/**
 * Saves a vlog to the account. If another device changed it since this one
 * last looked, the two are merged first (see mergeProjects).
 */
export function pushProject(id: string, opts: { force?: boolean } = {}): Promise<boolean> {
  return queued(id, async () => {
    const uid = await backend.userId()
    let project = await db.projects.get(id)
    if (!uid || !project || !isMine(project, uid)) return false
    let state = await db.sync.get(id)
    if (!opts.force && state && project.updatedAt <= state.syncedAt) return false

    const remoteAt = await backend.updatedAt(id)
    if (remoteAt && Date.parse(remoteAt) !== state?.cloudAt) {
      await mergeFromAccount(uid, id)
      project = (await db.projects.get(id))!
      state = await db.sync.get(id)
    }

    const clips = await db.clips.where('projectId').equals(id).toArray()
    const draft = toDraft({ ...project, ownerId: uid }, clips)
    const used = [...mediaInUse(draft.project)]
    const files = new Set(state?.files ?? [])
    for (const key of used) {
      if (files.has(key)) continue
      const blob = await getMedia(key)
      if (!blob) continue
      await backend.upload(mediaPath(uid, id, key), blob)
      files.add(key)
    }
    const gone = [...files].filter((k) => !used.includes(k))
    if (gone.length) await backend.removeFiles(gone.map((k) => mediaPath(uid, id, k)))
    gone.forEach((k) => files.delete(k))

    await backend.put({ id, title: project.title, step: project.step, cover: coverOf(project, clips), updated_at: new Date(project.updatedAt).toISOString(), data: draft })
    if (!project.ownerId) {
      // Without touching updatedAt: claiming a vlog isn't a change to it.
      await db.projects.update(id, { ownerId: uid })
      await refreshOpen(id)
    }
    await db.sync.put({ projectId: id, syncedAt: project.updatedAt, cloudAt: project.updatedAt, files: [...files] })
    return true
  })
}

/** Brings the account copy here: new on this device, or merged with the copy already here. */
async function mergeFromAccount(uid: string, id: string): Promise<Project | null> {
  const row = await backend.get(id)
  if (!row) return null
  const remote: CloudDraft = row.data
  const local = await db.projects.get(id)
  const state = await db.sync.get(id)
  const localClips = await db.clips.where('projectId').equals(id).toArray()
  const unchangedHere = !local || (state && local.updatedAt <= state.syncedAt)

  // Only the other device changed it: take its copy (Undo goes back to this one). Both changed: the newer wins.
  const project: Project = !local ? { ...remote.project, ownerId: uid } : { ...mergeProjects(local, remote.project, unchangedHere ? { remoteWins: true, keepOther: false } : {}), ownerId: uid }

  const clips = mergeClips(localClips, remote.clips)
  for (const key of mediaInUse(project)) {
    if (await getMedia(key)) continue
    const blob = await backend.download(mediaPath(uid, id, key))
    if (blob) await putMedia(key, blob)
  }
  await db.clips.bulkPut(clips)
  const bothChanged = !!local && !unchangedHere
  // When both changed, the merged copy is newer than either and goes back up on the next save.
  const saved = bothChanged ? { ...project, updatedAt: Date.now() } : project
  await db.projects.put(saved)
  await db.sync.put({
    projectId: id,
    syncedAt: bothChanged ? 0 : saved.updatedAt,
    cloudAt: Date.parse(row.updated_at),
    files: [...mediaInUse(remote.project)],
  })
  await refreshOpen(id)
  return saved
}

/** Opens a vlog from the account on this device (Home), or brings this device's copy up to date. */
export function pullProject(id: string): Promise<Project | null> {
  return queued(id, async () => {
    const uid = await backend.userId()
    return uid ? mergeFromAccount(uid, id) : null
  })
}

/**
 * After signing in, and when Home opens: vlogs made here go up (including ones
 * made before signing in), and ones changed on another device come down.
 * Returns the account's list for Home.
 */
export async function syncAll(): Promise<CloudRow[]> {
  const uid = await backend.userId()
  if (!uid) return []
  const rows = await backend.list()
  const local = new Map((await db.projects.toArray()).map((p) => [p.id, p]))
  for (const row of rows) {
    const p = local.get(row.id)
    const state = await db.sync.get(row.id)
    if (p && isMine(p, uid) && Date.parse(row.updated_at) !== state?.cloudAt) await pullProject(row.id)
  }
  for (const p of local.values()) {
    if (!isMine(p, uid) || !p.edits.length && !p.clipIds.length) continue
    await pushProject(p.id)
  }
  return backend.list()
}

/** Saves the finished video to the account (replacing the last one). Throws SpaceFull when it won't fit. */
export async function uploadVideo(id: string, video: Blob): Promise<void> {
  const uid = await backend.userId()
  if (!uid) return
  await pushProject(id, { force: true })
  await queued(id, async () => {
    const space = await backend.space()
    const rows = await backend.list()
    const previous = rows.find((r) => r.id === id)?.video_bytes ?? 0
    if (space.used - previous + video.size > space.limit) throw new SpaceFull('Your account space is full, so this video is only on this device. Delete old vlogs to make room, or go Pro for more space.')
    await backend.upload(videoPath(uid, id), video)
    await backend.setVideo(id, video.size)
  })
}

/** A link to watch or download the finished video saved in the account. */
export async function videoLink(id: string, fileName?: string): Promise<string | null> {
  const uid = await backend.userId()
  return uid ? backend.link(videoPath(uid, id), fileName) : null
}

/** Removes a vlog and its files from the account. */
export function deleteFromAccount(id: string): Promise<void> {
  return queued(id, async () => {
    const uid = await backend.userId()
    if (!uid) return
    const files = await backend.listFiles(folder(uid, id))
    await backend.removeFiles(files)
    await backend.remove(id)
    await db.sync.delete(id)
  })
}

export const accountSpace = () => backend.space()

/**
 * Removes this account's vlogs from this device when they're saved in the
 * account and up to date. Ones not saved yet stay. Returns how many went.
 */
export async function clearDevice(deleteLocal: (id: string) => Promise<void>): Promise<{ removed: number; kept: number }> {
  const uid = await backend.userId()
  if (!uid) return { removed: 0, kept: 0 }
  let removed = 0
  let kept = 0
  for (const p of await db.projects.toArray()) {
    if (p.ownerId !== uid) continue
    const state = await db.sync.get(p.id)
    if (state && p.updatedAt <= state.syncedAt) {
      await deleteLocal(p.id)
      await db.sync.delete(p.id)
      removed++
    } else kept++
  }
  return { removed, kept }
}
