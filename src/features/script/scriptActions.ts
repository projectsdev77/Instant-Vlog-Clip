import { ai, AiError } from '@/ai'
import { buildCatalog } from '@/ai/catalog'
import { uid } from '@/domain/ids'
import type { Script } from '@/domain/types'
import { useProject } from '@/store/projectStore'
import { analyzeClipsUpTo } from '@/pipeline/analysis'
import { deleteMedia } from '@/lib/mediaStore'

/** Asks the AI to write (or polish) the script and stores it on the project. */
export type ScriptStage = { stage: 'clips'; done: number; total: number } | { stage: 'writing' }

export async function generateScript(mode: 'write' | 'polish', onStage?: (s: ScriptStage) => void): Promise<{ lines: number; changed: string[] } | undefined> {
  const { project, updateProject } = useProject.getState()
  if (!project) return
  if (mode === 'polish') return polishScript()
  // Script quality depends on knowing what's in the clips, but don't wait forever:
  // after 25 s, write from what's known (on-device signals for the rest).
  await analyzeClipsUpTo(25_000, (done, total) => onStage?.({ stage: 'clips', done, total }))
  onStage?.({ stage: 'writing' })
  const { clips } = useProject.getState()
  // Write mode ignores existing lines except as hints the AI may reuse.
  const current = project.script?.lines.map((l) => l.text.trim()).filter(Boolean) ?? []
  const res = await ai.writeScript({
    mode: 'write',
    language: project.settings.language,
    title: project.title,
    prompt: project.prompt,
    lines: current,
    targetSec: project.settings.targetSec,
    vibe: project.settings.vibe,
    template: project.settings.template === 'auto' ? undefined : project.settings.template,
    catalog: buildCatalog(clips),
  })
  if (!res.lines.length) throw new AiError("The AI couldn't write a script for these clips.", 'upstream')
  const script: Script = {
    title: res.title,
    lines: res.lines.map((l) => ({ id: uid('l_'), text: l.text, purpose: l.purpose, visualIntent: l.visualIntent, onScreenText: l.onScreenText || undefined })),
  }
  for (const l of project.script?.lines ?? []) if (l.audio) void deleteMedia(l.audio.mediaKey)
  await updateProject((p) => ({ script, title: p.title || res.title }))
  return { lines: script.lines.length, changed: script.lines.map((l) => l.id) }
}

/** Polish: a focused copy-edit of the user's lines. Each line keeps its place and identity. */
async function polishScript(): Promise<{ lines: number; changed: string[] } | undefined> {
  const { project, updateProject } = useProject.getState()
  const filled = (project?.script?.lines ?? []).filter((l) => l.text.trim())
  if (!project?.script || !filled.length) return
  const polished = await ai.polishLines(
    filled.map((l) => l.text.trim()),
    project.settings.language,
  )
  const byId = new Map(filled.map((l, i) => [l.id, polished[i]]))
  const norm = (t: string) => t.trim().replace(/\s+/g, ' ')
  const changed = filled.filter((l, i) => norm(polished[i] ?? l.text) !== norm(l.text)).map((l) => l.id)
  // Apply to the latest lines (the user may have typed elsewhere meanwhile); voice for changed lines is stale.
  await updateProject((p) => ({
    script: p.script && { ...p.script, lines: p.script.lines.map((l) => (byId.has(l.id) && changed.includes(l.id) ? { ...l, text: byId.get(l.id)!, audio: undefined } : l)) },
  }))
  for (const l of filled) if (changed.includes(l.id) && l.audio) void deleteMedia(l.audio.mediaKey)
  return { lines: filled.length, changed }
}
