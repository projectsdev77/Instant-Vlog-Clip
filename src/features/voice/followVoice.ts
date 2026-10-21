import type { Project } from '@/domain/types'
import { toast } from '@/components/ui/Toast'
import { matchScriptToVoice } from '@/features/edit/editActions'
import { useProject } from '@/store/projectStore'

/** How the user records their own voice: read the script, or say their own thing. */
export function followOf(p: Project): 'script' | 'own' {
  return p.voiceTrack?.follow ?? (p.script?.lines.some((l) => l.text.trim()) ? 'script' : 'own')
}

// "Say my own thing": whenever a take's captions arrive, or takes are moved,
// trimmed, split or deleted, the script and footage catch up with what was
// said. Runs one at a time; importing this module turns it on.
let last = ''
let queue = Promise.resolve()
useProject.subscribe((s) => {
  const p = s.project
  if (!p || p.voice.mode !== 'recorded' || followOf(p) !== 'own' || !p.voiceTrack?.takes.length) return
  const key = JSON.stringify([p.id, p.voiceTrack.takes.map((t) => [t.id, t.start, t.in, t.out, t.transcript])])
  if (key === last) return
  last = key
  queue = queue
    .then(async () => {
      const { changed: n, undo } = await matchScriptToVoice()
      if (n) toast(`Your script now follows what you said (${n} part${n === 1 ? '' : 's'}).`, 'info', { label: 'Undo', run: () => void undo() })
    })
    .catch((e) => console.warn('Matching the script to your voice failed', e))
})
