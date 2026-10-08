import { db } from './db'

/**
 * Stores users' media on this device only. Uses the Origin Private File System
 * where writable files are supported (fast, no copies in memory), otherwise
 * IndexedDB blobs.
 */

const urlCache = new Map<string, string>()
const blobCache = new Map<string, Blob>()

async function opfsDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!navigator.storage?.getDirectory) return null
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('media', { create: true })
    // Safari main thread lacks createWritable; fall back to IndexedDB there.
    const probe = await dir.getFileHandle('.probe', { create: true })
    if (!('createWritable' in probe)) return null
    return dir
  } catch {
    return null
  }
}

let dirPromise: Promise<FileSystemDirectoryHandle | null> | null = null
const getDir = () => (dirPromise ??= opfsDir())

const safeName = (key: string) => key.replace(/[^a-zA-Z0-9_.-]/g, '_')

export async function requestPersistentStorage() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    /* not supported */
  }
}

export async function putMedia(key: string, blob: Blob): Promise<void> {
  blobCache.set(key, blob)
  const dir = await getDir()
  if (dir) {
    const handle = await dir.getFileHandle(safeName(key), { create: true })
    const w = await handle.createWritable()
    await w.write(blob)
    await w.close()
    return
  }
  await db.media.put({ key, blob })
}

export async function getMedia(key: string): Promise<Blob | null> {
  const cached = blobCache.get(key)
  if (cached) return cached
  const dir = await getDir()
  if (dir) {
    try {
      const file = await (await dir.getFileHandle(safeName(key))).getFile()
      blobCache.set(key, file)
      return file
    } catch {
      /* fall through to IndexedDB (older data) */
    }
  }
  const row = await db.media.get(key)
  if (row) blobCache.set(key, row.blob)
  return row?.blob ?? null
}

export async function getMediaUrl(key: string): Promise<string | null> {
  const hit = urlCache.get(key)
  if (hit) return hit
  const blob = await getMedia(key)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(key, url)
  return url
}

export async function deleteMedia(key: string): Promise<void> {
  const url = urlCache.get(key)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(key)
  blobCache.delete(key)
  const dir = await getDir()
  if (dir) await dir.removeEntry(safeName(key)).catch(() => {})
  await db.media.delete(key)
}
