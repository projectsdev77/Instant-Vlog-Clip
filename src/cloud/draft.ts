// The vlog as saved in the account, and how two copies are merged when the
// same vlog was changed on two devices. Plain functions, no storage.
import { uid } from '@/domain/ids'
import type { Clip, EditGlobals, Project, SavedVersion } from '@/domain/types'

/** What the account keeps for a vlog (the files go to storage separately). */
export type CloudDraft = { format: 1; project: Project; clips: Clip[] }

/**
 * The draft without what only matters on this device: the undo history (the
 * current edit and the saved versions are kept) and the clips' contact sheets.
 */
export function toDraft(project: Project, clips: Clip[]): CloudDraft {
  const current = project.edits[project.currentEdit]
  return {
    format: 1,
    project: { ...project, edits: current ? [current] : [], currentEdit: current ? 0 : -1 },
    clips: clips.map((c) => {
      const { contactSheet: _sheet, ...rest } = c
      return { ...rest, status: c.status === 'importing' || c.status === 'analyzing' ? 'ready' : c.status }
    }),
  }
}

const globalsOf = (p: Project): EditGlobals => ({ title: p.title, musicTrackId: p.musicTrackId, musicGainDb: p.musicGainDb, styleId: p.styleId, voice: p.voice, targetSec: p.settings.targetSec })

/** What the user would see as different between two copies. */
const look = (p: Project) => JSON.stringify([p.edits[p.currentEdit]?.scenes, p.script?.lines.map((l) => l.text), globalsOf(p)])

/** Saved versions from both copies, oldest first, each once. */
function allVersions(a: Project, b: Project): SavedVersion[] {
  const byId = new Map([...(a.versions ?? []), ...(b.versions ?? [])].map((v) => [v.id, v]))
  return [...byId.values()].sort((x, y) => x.createdAt - y.createdAt)
}

/**
 * The same vlog changed here and on another device: the newer copy wins, and
 * the other one's edit is kept as a saved version so nothing is lost. When the
 * other device wins, its edit becomes a new undo step here. `remoteWins`
 * forces the account copy and `keepOther: false` skips the extra version
 * (both for when only the other device changed it).
 */
export function mergeProjects(local: Project, remote: Project, opts: { now?: number; remoteWins?: boolean; keepOther?: boolean } = {}): Project {
  const now = opts.now ?? Date.now()
  const remoteWins = opts.remoteWins ?? remote.updatedAt >= local.updatedAt
  const [winner, loser] = remoteWins ? [remote, local] : [local, remote]
  const versions = allVersions(local, remote)
  const loserEdit = loser.edits[loser.currentEdit]
  if (opts.keepOther !== false && loserEdit && look(loser) !== look(winner)) {
    versions.push({
      id: uid('v_'),
      createdAt: now,
      reason: 'sync',
      name: remoteWins ? 'This device’s copy, before syncing' : 'Copy from another device',
      changes: 0,
      plan: { ...loserEdit, script: undefined, globals: undefined },
      script: loser.script,
      globals: globalsOf(loser),
    })
  }
  if (!remoteWins) return { ...local, versions }
  const mine = local.edits.slice(0, local.currentEdit + 1)
  const theirs = remote.edits[remote.currentEdit]
  const edits = theirs ? [...mine, { ...theirs, version: (mine[mine.length - 1]?.version ?? 0) + 1, script: remote.script }] : mine
  return { ...remote, edits, currentEdit: edits.length - 1, versions }
}

/** Clips of both copies: this device's records win; clips only in the account are listed as missing until added again. */
export function mergeClips(local: Clip[], remote: Clip[]): Clip[] {
  const here = new Set(local.map((c) => c.id))
  return [...local, ...remote.filter((c) => !here.has(c.id)).map((c) => ({ ...c, status: 'missing' as const }))]
}
