// Saved versions, like Figma's version history. Undo / Redo step through every
// change; the Versions list only keeps checkpoints: after an editing session
// (a few quiet minutes, or leaving the Edit page), before Ask AI changes the
// vlog, on export, and whenever the user saves one by name.
import { useEffect } from 'react'
import { uid } from '@/domain/ids'
import type { EditGlobals, EditPlan, Project, SavedVersion, VersionReason } from '@/domain/types'
import { currentEdit, useProject } from '@/store/projectStore'
import { restoreGlobals } from './editActions'

const state = () => useProject.getState()

/** Quiet time after the last change that ends an editing session. */
export const SESSION_IDLE_MS = 3 * 60_000
/** Automatic versions kept; ones the user named are always kept. */
const MAX_AUTO = 30

export const globalsOf = (p: Project): EditGlobals => ({ title: p.title, musicTrackId: p.musicTrackId, musicGainDb: p.musicGainDb, styleId: p.styleId, voice: p.voice, targetSec: p.settings.targetSec })

/** What a version captures, to tell whether anything changed since the last one. */
const snapshot = (plan: EditPlan, script: Project['script'], globals: EditGlobals) => {
  const { version: _v, createdAt: _c, createdBy: _b, note: _n, script: _s, globals: _g, ...rest } = plan
  return JSON.stringify([rest, script?.lines.map((l) => [l.text, l.muted, l.delivery, l.seed, l.audio?.mediaKey]), globals])
}

const latest = (p: Project) => p.versions?.[p.versions.length - 1]

/** True when the vlog differs from the newest saved version. */
export function hasUnsavedChanges(p: Project | null): boolean {
  const plan = currentEdit(p)
  if (!p || !plan) return false
  const last = latest(p)
  return !last || snapshot(last.plan, last.script, last.globals) !== snapshot(plan, p.script, globalsOf(p))
}

/**
 * Saves the vlog as it is now. Automatic saves are skipped when nothing
 * changed since the last version; a named save always happens.
 */
export async function saveVersion(reason: VersionReason, name?: string): Promise<SavedVersion | undefined> {
  const p = state().project
  const plan = currentEdit(p)
  if (!p || !plan) return
  if (reason !== 'manual' && !hasUnsavedChanges(p)) return
  const last = latest(p)
  const version: SavedVersion = {
    id: uid('v_'),
    createdAt: Date.now(),
    reason,
    name: name?.trim() || undefined,
    // Undo steps since the last version, roughly what the user did in this session.
    changes: last ? Math.max(1, plan.version - last.plan.version) : 0,
    plan: { ...plan, script: undefined, globals: undefined },
    script: p.script,
    globals: globalsOf(p),
  }
  await state().updateProject((q) => {
    const all = [...(q.versions ?? []), version]
    // Drop the oldest automatic ones past the limit; named ones stay.
    let extra = all.filter((v) => v.reason !== 'manual').length - MAX_AUTO
    const versions = all.filter((v) => !(extra > 0 && v.reason !== 'manual' && v.reason !== 'start' && extra-- > 0))
    return { versions }
  })
  return version
}

/** Brings a saved version back as a new step (so Undo goes back to what was there); the current state is saved first. */
export async function restoreVersion(id: string) {
  const p = state().project
  const v = p?.versions?.find((x) => x.id === id)
  if (!p || !v) return
  await saveVersion('restore')
  await state().updateProject((q) => ({ script: v.script, ...restoreGlobals(q, v.globals) }))
  await state().pushEdit({ ...v.plan, createdBy: 'user', createdAt: Date.now(), globals: v.globals })
}

/** What a version is called in the list. */
export function versionLabel(v: SavedVersion): string {
  if (v.reason === 'manual' && v.name) return v.name
  if (v.reason === 'ai') return v.name ? `Before Ask AI: “${v.name}”` : 'Before an Ask AI change'
  return { start: 'First edit', session: 'Editing session', export: 'Exported', restore: 'Before restoring a version', manual: 'Saved version', ai: '' }[v.reason]
}

/**
 * Edit page: saves the first version, then one after each editing session
 * (quiet for a few minutes, the tab hidden, or leaving the page).
 */
export function useAutoVersions(project: Project | null) {
  const id = project?.id
  const hasEdit = !!currentEdit(project)
  const version = currentEdit(project)?.version
  const globals = project ? JSON.stringify(globalsOf(project)) : ''
  // The first version: the edit as Make left it.
  useEffect(() => {
    if (id && hasEdit && !state().project?.versions?.length) void saveVersion('start')
  }, [id, hasEdit])
  // A session ends after a quiet spell following any change.
  useEffect(() => {
    if (!id || version === undefined) return
    const t = setTimeout(() => void saveVersion('session'), SESSION_IDLE_MS)
    return () => clearTimeout(t)
  }, [id, version, globals])
  // …or when the tab is hidden or the Edit page closes.
  useEffect(() => {
    if (!id) return
    const onHide = () => document.visibilityState === 'hidden' && void saveVersion('session')
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void saveVersion('session')
    }
  }, [id])
}
