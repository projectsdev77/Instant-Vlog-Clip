import { ai, AiError } from '@/ai'
import { buildCatalog } from '@/ai/catalog'
import { uid } from '@/domain/ids'
import type { Script } from '@/domain/types'
import { useProject } from '@/store/projectStore'
import { analyzeClipsInBackground } from '@/pipeline/analysis'
import { deleteMedia } from '@/lib/mediaStore'

/** Asks the AI to write (or polish) the script and stores it on the project. */
export async function generateScript(mode: 'write' | 'polish'): Promise<void> {
  const { project, updateProject } = useProject.getState()
  if (!project) return
  // Script quality depends on knowing what's in the clips.
  await analyzeClipsInBackground({ waitForImports: true })
  const { clips } = useProject.getState()
  const current = project.script?.lines.map((l) => l.text.trim()).filter(Boolean) ?? []
  const res = await ai.writeScript({
    mode,
    language: project.settings.language,
    title: project.title,
    prompt: project.prompt,
    lines: current,
    targetSec: project.settings.targetSec,
    vibe: project.settings.vibe,
    catalog: buildCatalog(clips),
  })
  if (!res.lines.length) throw new AiError("The AI couldn't write a script for these clips.", 'upstream')
  const script: Script = {
    title: res.title,
    lines: res.lines.map((l) => ({ id: uid('l_'), text: l.text, purpose: l.purpose, visualIntent: l.visualIntent, onScreenText: l.onScreenText || undefined })),
  }
  for (const l of project.script?.lines ?? []) if (l.audio) void deleteMedia(l.audio.mediaKey)
  await updateProject((p) => ({ script, title: p.title || res.title }))
}
