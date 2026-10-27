import { beforeEach, describe, expect, it } from 'vitest'
import { makeClip, makeScript } from '@/test/fixtures'
import type { EditPlan, Project } from '@/domain/types'
import { db } from '@/lib/db'
import { deleteMedia, getMedia, putMedia } from '@/lib/mediaStore'
import { createProject, useProject } from '@/store/projectStore'
import { matchClip } from '@/features/clips/relink'
import type { CloudBackend, CloudRow } from './backend'
import type { CloudDraft } from './draft'
import { deleteFromAccount, pullProject, pushProject, SpaceFull, uploadVideo, useBackend } from './sync'

/** An account in memory: rows and files, like the vlogs table and bucket. */
function memoryAccount(uid = 'u1', limit = 10_000_000) {
  const rows = new Map<string, CloudRow & { data: CloudDraft }>()
  const files = new Map<string, Blob>()
  const backend: CloudBackend = {
    userId: async () => uid,
    list: async () => [...rows.values()].map(({ data: _d, ...r }) => r),
    updatedAt: async (id) => rows.get(id)?.updated_at ?? null,
    get: async (id) => structuredClone(rows.get(id) ?? null),
    put: async (row) => void rows.set(row.id, { video_bytes: rows.get(row.id)?.video_bytes ?? null, video_at: null, ...structuredClone(row) }),
    setVideo: async (id, bytes) => void (rows.get(id)!.video_bytes = bytes),
    remove: async (id) => void rows.delete(id),
    upload: async (path, blob) => void files.set(path, blob),
    download: async (path) => files.get(path) ?? null,
    removeFiles: async (paths) => paths.forEach((p) => files.delete(p)),
    listFiles: async (folder) => [...files.keys()].filter((k) => k.startsWith(`${folder}/`)),
    link: async (path) => (files.has(path) ? `https://files/${path}` : null),
    space: async () => ({ used: [...files.values()].reduce((a, b) => a + b.size, 0), limit, plan: 'free' }),
  }
  return { rows, files, backend }
}

const plan = (version: number, clipId = 'c1'): EditPlan => ({
  version,
  createdAt: 0,
  createdBy: 'ai',
  aspect: '9:16',
  fps: 30,
  title: { text: 'Day', showUntilSec: 3 },
  scenes: [{ id: 'a', lineId: 'l0', shots: [{ id: 's1', clipId, in: 0, out: 2, crop: { focusX: 0.5, focusY: 0.5, zoom: 1 }, clipAudio: 'mute', transitionIn: 'cut' }] }],
})

/** A vlog on this device: one clip, a voiced line, two undo steps. */
async function makeVlog(): Promise<Project> {
  const p = await createProject()
  useProject.setState({ project: null, clips: [] })
  await useProject.getState().load(p.id)
  await useProject.getState().addClip(makeClip('c1', 9, { projectId: p.id, fileName: 'beach.mp4', sizeBytes: 1234, thumbnail: 'data:image/jpeg;base64,xx', contactSheet: { dataUrl: 'data:big', times: [0] } }))
  await putMedia('media-c1', new Blob(['video']))
  await putMedia('vo-0', new Blob(['voice']))
  await useProject.getState().updateProject({ title: 'Beach day', script: makeScript(['Hello there']) })
  await useProject.getState().pushEdit(plan(0))
  await useProject.getState().pushEdit(plan(0))
  return useProject.getState().project!
}

/** Another device: nothing of this vlog here yet. */
async function newDevice() {
  useProject.setState({ project: null, clips: [] })
  await Promise.all(['media-c1', 'vo-0'].map(deleteMedia))
  await Promise.all([db.projects.clear(), db.clips.clear(), db.sync.clear(), db.media.clear()])
}

describe('account sync', () => {
  let account: ReturnType<typeof memoryAccount>
  beforeEach(async () => {
    await newDevice()
    account = memoryAccount()
    useBackend(account.backend)
  })

  it('saves the draft without undo history or contact sheets, with its voice audio, and marks it as this account’s', async () => {
    const p = await makeVlog()
    expect(await pushProject(p.id)).toBe(true)
    const row = account.rows.get(p.id)!
    expect(row.title).toBe('Beach day')
    expect(row.cover).toBe('data:image/jpeg;base64,xx')
    expect(row.data.project.edits).toHaveLength(1)
    expect(row.data.clips[0].contactSheet).toBeUndefined()
    expect([...account.files.keys()]).toEqual([`u1/${p.id}/media/vo-0`])
    // the original clip is never uploaded
    expect([...account.files.keys()].some((k) => k.includes('media-c1'))).toBe(false)
    expect((await db.projects.get(p.id))!.ownerId).toBe('u1')
    // nothing new: nothing sent
    expect(await pushProject(p.id)).toBe(false)
  })

  it('opens on another device with the voice audio, and the clips waiting to be added again', async () => {
    const p = await makeVlog()
    await pushProject(p.id)
    await newDevice()
    const opened = await pullProject(p.id)
    expect(opened!.title).toBe('Beach day')
    const clips = await db.clips.where('projectId').equals(p.id).toArray()
    expect(clips.map((c) => [c.id, c.status])).toEqual([['c1', 'missing']])
    expect(await getMedia('vo-0')).not.toBeNull()
    expect(await getMedia('media-c1')).toBeNull()
    // the file picked again goes back in its place
    expect(matchClip({ name: 'beach.mp4', size: 1234 }, clips)?.id).toBe('c1')
    expect(matchClip({ name: 'renamed.mp4', size: 1234 }, clips)?.id).toBe('c1')
    expect(matchClip({ name: 'other.mp4', size: 5 }, clips)).toBeUndefined()
  })

  it('when both devices changed the vlog, the newer wins and the other is kept as a saved version', async () => {
    const p = await makeVlog()
    await pushProject(p.id)
    // Another device renames it later…
    const theirs = structuredClone(account.rows.get(p.id)!)
    theirs.data.project = { ...theirs.data.project, title: 'Beach day (phone)', updatedAt: p.updatedAt + 60_000, edits: [plan(5, 'c9')] }
    theirs.updated_at = new Date(theirs.data.project.updatedAt).toISOString()
    account.rows.set(p.id, theirs)
    // …while this device changed it too, earlier.
    await useProject.getState().updateProject({ prompt: 'changed here' })
    await pushProject(p.id)
    const merged = (await db.projects.get(p.id))!
    expect(merged.title).toBe('Beach day (phone)')
    expect(merged.edits[merged.currentEdit].scenes[0].shots[0].clipId).toBe('c9')
    expect(merged.versions?.some((v) => v.reason === 'sync' && v.plan.scenes[0].shots[0].clipId === 'c1')).toBe(true)
    // …and the merged copy went back up
    expect(account.rows.get(p.id)!.data.project.versions?.some((v) => v.reason === 'sync')).toBe(true)
  })

  it('saves the finished video, refuses it when the account is full, and deletes everything', async () => {
    const p = await makeVlog()
    await uploadVideo(p.id, new Blob(['x'.repeat(100)], { type: 'video/mp4' }))
    expect(account.files.has(`u1/${p.id}/video.mp4`)).toBe(true)
    expect(account.rows.get(p.id)!.video_bytes).toBe(100)

    const full = memoryAccount('u1', 50)
    useBackend(full.backend)
    await expect(uploadVideo(p.id, new Blob(['x'.repeat(100)]))).rejects.toBeInstanceOf(SpaceFull)

    useBackend(account.backend)
    await deleteFromAccount(p.id)
    expect(account.rows.has(p.id)).toBe(false)
    expect(account.files.size).toBe(0)
  })

  it('leaves another account’s vlogs on this device alone', async () => {
    const p = await makeVlog()
    await db.projects.update(p.id, { ownerId: 'someone-else' })
    expect(await pushProject(p.id)).toBe(false)
    expect(account.rows.size).toBe(0)
  })
})
