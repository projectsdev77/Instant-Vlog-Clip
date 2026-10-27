// Where account copies live: a `vlogs` table (one row per vlog) and a private
// `vlogs` bucket with each user's files under <user id>/<vlog id>/.
// See supabase/migrations/20261027000000_vlog_storage.sql.
import type { CloudDraft } from './draft'
import { supabase } from '@/lib/supabase'

/** A vlog in the account, as listed on Home. */
export type CloudRow = {
  id: string
  title: string
  step: string
  cover: string | null
  video_bytes: number | null
  video_at: string | null
  updated_at: string
}

export type Space = { used: number; limit: number; plan: 'free' | 'pro' }

export interface CloudBackend {
  /** the signed-in user's id, or null */
  userId(): Promise<string | null>
  list(): Promise<CloudRow[]>
  /** the account copy's updated_at, or null when there isn't one */
  updatedAt(id: string): Promise<string | null>
  get(id: string): Promise<(CloudRow & { data: CloudDraft }) | null>
  put(row: Omit<CloudRow, 'video_bytes' | 'video_at'> & { data: CloudDraft }): Promise<void>
  setVideo(id: string, bytes: number | null): Promise<void>
  remove(id: string): Promise<void>
  upload(path: string, blob: Blob): Promise<void>
  download(path: string): Promise<Blob | null>
  removeFiles(paths: string[]): Promise<void>
  listFiles(folder: string): Promise<string[]>
  /** a link to a private file that works for a while; `download` names the saved file */
  link(path: string, download?: string): Promise<string | null>
  space(): Promise<Space>
}

const BUCKET = 'vlogs'
const ROW = 'id, title, step, cover, video_bytes, video_at, updated_at'

/** Fails with a plain message (the service's own text goes to the console). */
function check<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) {
    console.error(`Account storage: ${what}:`, r.error.message)
    throw new Error(/exceeded|too large|payload/i.test(r.error.message) ? 'This file is too big to save to your account.' : 'Couldn’t reach your account. Your work is safe on this device; it will be saved when you’re back online.')
  }
  return r.data
}

export const supabaseBackend: CloudBackend = {
  async userId() {
    return (await supabase?.auth.getSession())?.data.session?.user.id ?? null
  },
  async list() {
    return check(await supabase!.from('vlogs').select(ROW).order('updated_at', { ascending: false }), 'list') as CloudRow[]
  },
  async updatedAt(id) {
    const rows = check(await supabase!.from('vlogs').select('updated_at').eq('id', id).limit(1), 'check') as { updated_at: string }[]
    return rows[0]?.updated_at ?? null
  },
  async get(id) {
    const rows = check(await supabase!.from('vlogs').select(`${ROW}, data`).eq('id', id).limit(1), 'open') as (CloudRow & { data: CloudDraft })[]
    return rows[0] ?? null
  },
  async put(row) {
    check(await supabase!.from('vlogs').upsert(row, { onConflict: 'user_id,id' }), 'save')
  },
  async setVideo(id, bytes) {
    check(await supabase!.from('vlogs').update({ video_bytes: bytes, video_at: bytes === null ? null : new Date().toISOString() }).eq('id', id), 'video')
  },
  async remove(id) {
    check(await supabase!.from('vlogs').delete().eq('id', id), 'delete')
  },
  async upload(path, blob) {
    check(await supabase!.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' }), 'upload')
  },
  async download(path) {
    const r = await supabase!.storage.from(BUCKET).download(path)
    if (r.error) {
      console.warn('Account storage: download', path, r.error.message)
      return null
    }
    return r.data
  },
  async removeFiles(paths) {
    if (paths.length) check(await supabase!.storage.from(BUCKET).remove(paths), 'remove files')
  },
  async listFiles(folder) {
    // One level per call; a vlog's folder holds media/ and video.mp4.
    const out: string[] = []
    const walk = async (dir: string) => {
      const items = check(await supabase!.storage.from(BUCKET).list(dir, { limit: 1000 }), 'list files') as { name: string; id: string | null }[]
      for (const it of items) {
        const path = `${dir}/${it.name}`
        if (it.id) out.push(path)
        else await walk(path)
      }
    }
    await walk(folder)
    return out
  },
  async link(path, download) {
    const r = await supabase!.storage.from(BUCKET).createSignedUrl(path, 60 * 60, download ? { download } : undefined)
    return r.error ? null : r.data.signedUrl
  },
  async space() {
    return check(await supabase!.rpc('my_storage'), 'space') as Space
  },
}
