import Dexie, { type EntityTable } from 'dexie'
import type { Clip, Project } from '@/domain/types'

type MediaRow = { key: string; blob: Blob }

export const db = new Dexie('instant-vlog-clip') as Dexie & {
  projects: EntityTable<Project, 'id'>
  clips: EntityTable<Clip, 'id'>
  media: EntityTable<MediaRow, 'key'>
}

db.version(1).stores({
  projects: 'id, updatedAt',
  clips: 'id, projectId',
  media: 'key',
})
