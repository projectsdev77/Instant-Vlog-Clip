import Dexie, { type EntityTable } from 'dexie'
import type { Clip, Project } from '@/domain/types'

type MediaRow = { key: string; blob: Blob }

/** What this device last sent to (or got from) the account for one vlog. */
export type SyncRow = {
  projectId: string
  /** the project's updatedAt when it was last saved to the account */
  syncedAt: number
  /** the account copy's updated_at (ms) as last seen here; a different one means another device changed it */
  cloudAt: number
  /** stored files already in the account (voice audio, own song) */
  files: string[]
}

export const db = new Dexie('instant-vlog-clip') as Dexie & {
  projects: EntityTable<Project, 'id'>
  clips: EntityTable<Clip, 'id'>
  media: EntityTable<MediaRow, 'key'>
  sync: EntityTable<SyncRow, 'projectId'>
}

db.version(1).stores({
  projects: 'id, updatedAt',
  clips: 'id, projectId',
  media: 'key',
})

db.version(2).stores({
  projects: 'id, updatedAt',
  clips: 'id, projectId',
  media: 'key',
  sync: 'projectId',
})
