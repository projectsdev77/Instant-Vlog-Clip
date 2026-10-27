import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditOpWire, EditResponse } from '@shared/contracts.ts'
import { makeClip, makeScript } from '@/test/fixtures'
import type { EditPlan } from '@/domain/types'
import { createProject, currentEdit, useProject } from '@/store/projectStore'
import { askAi, editState, suggestionsFor } from './askAi'
import { undo } from './editActions'

const answer = vi.hoisted(() => ({ next: { reply: '', ops: [] } as EditResponse }))
vi.mock('@/ai', async (original) => {
  const real = await original<typeof import('@/ai')>()
  return { ...real, ai: { ...real.ai, editRequest: vi.fn(async () => answer.next) } }
})

const op = (o: Partial<EditOpWire> & Pick<EditOpWire, 'op'>): EditOpWire => ({ scene: '', shot: 0, to: 0, value: '', amount: 0, ...o })
const shot = (id: string, clipId: string, inPoint: number, out: number) => ({ id, clipId, in: inPoint, out, crop: { focusX: 0.5, focusY: 0.5, zoom: 1 }, clipAudio: 'mute' as const, transitionIn: 'cut' as const })

async function setUp(handEdits?: EditPlan['handEdits']) {
  const p = await createProject()
  useProject.setState({ project: null, clips: [] })
  await useProject.getState().load(p.id)
  const clips = [
    makeClip('c1', 10, { projectId: p.id, analysis: { description: 'A beach at sunset', tags: ['beach', 'sunset'], shotType: 'wide', quality: { shaky: false, blurry: false, dark: false, accidental: false }, moments: [{ start: 1, end: 6, score: 0.9, why: 'waves', focus: { x: 0.5, y: 0.5 } }] } }),
    makeClip('c2', 10, { projectId: p.id }),
  ]
  for (const c of clips) await useProject.getState().addClip(c)
  await useProject.getState().updateProject({ script: makeScript(['Hello there', 'Coffee first', 'Bye now']), musicTrackId: 'lofi-walk' })
  const plan: EditPlan = {
    version: 0,
    createdAt: 0,
    createdBy: 'ai',
    aspect: '9:16',
    fps: 30,
    title: { text: 'My Day', showUntilSec: 3 },
    scenes: [
      { id: 'a', lineId: 'l0', shots: [shot('x1', 'c1', 0, 2)] },
      { id: 'b', lineId: 'l1', shots: [shot('x2', 'c2', 0, 2)] },
      { id: 'c', lineId: 'l2', shots: [shot('x3', 'c2', 3, 5)] },
    ],
    handEdits,
  }
  await useProject.getState().pushEdit(plan)
}

const project = () => useProject.getState().project!
const plan = () => currentEdit(project())!

describe('Ask AI', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))

  it('applies every change as one version, skips ones that make no sense, and Undo takes it all back', async () => {
    await setUp()
    answer.next = {
      reply: 'Black and white, slower coffee, new music.',
      ops: [op({ op: 'filter', value: 'mono' }), op({ op: 'speed', scene: 's2', value: '0.5' }), op({ op: 'music', value: 'city-pop' }), op({ op: 'camera', scene: 's9', value: 'punch' }), op({ op: 'filter', value: 'sepia-ish' })],
    }
    const r = await askAi('black and white, slow the coffee, upbeat music')
    expect(r).toEqual({ reply: 'Black and white, slower coffee, new music.', changed: true })
    expect(project().edits.map((e) => e.version)).toEqual([1, 2])
    expect(plan().look?.filter).toBe('mono')
    expect(plan().scenes[1].shots[0].speed).toBe(0.5)
    expect(project().musicTrackId).toBe('city-pop')
    // what the AI changed doesn't count as the user's own edit
    expect(plan().handEdits).toBeUndefined()
    await undo()
    expect(project().currentEdit).toBe(0)
    expect(project().musicTrackId).toBe('lofi-walk')
    expect(plan().look?.filter ?? 'none').toBe('none')
  })

  it('asks before changing the user’s own edits; "keep" applies the rest, "change" overwrites them', async () => {
    await setUp({ b: ['effects'], c: ['words'] })
    const ops = [op({ op: 'speed', scene: 's2', value: '0.5' }), op({ op: 'rewrite-line', scene: 's3', value: 'See you soon' }), op({ op: 'camera', scene: 's1', value: 'punch' }), op({ op: 'clip-sound', scene: 's2', value: 'full' })]
    answer.next = { reply: 'Done.', ops }
    const decide = vi.fn(async () => ({ choice: 'keep' as const, remember: false }))
    const r = await askAi('punchier', [], decide)
    // only the speed of scene 2 and the words of scene 3 clash; the camera and the sound don't
    expect(decide).toHaveBeenCalledWith([
      { scene: 2, kinds: ['effects'] },
      { scene: 3, kinds: ['words'] },
    ])
    expect(r.reply).toContain('left your own changes in scene 2, 3')
    expect(plan().scenes[1].shots[0].speed).toBeUndefined()
    expect(plan().scenes[0].shots[0].motion).toBe('punch')
    expect(plan().scenes[1].shots[0].clipAudio).toBe('full')
    expect(plan().handEdits).toEqual({ b: ['effects'], c: ['words'] })

    await undo()
    await askAi('punchier', [], async () => ({ choice: 'change', remember: false }))
    expect(plan().scenes[1].shots[0].speed).toBe(0.5)
    // what the user let the AI change is no longer theirs
    expect(plan().handEdits).toEqual(undefined)
  })

  it('remembers the answer for this vlog when asked to, and backing out changes nothing', async () => {
    await setUp({ b: ['effects'] })
    answer.next = { reply: 'Slowed it down.', ops: [op({ op: 'speed', scene: 's2', value: '0.5' })] }
    expect(await askAi('slow down scene 2', [], async () => null)).toEqual({ reply: 'Okay, nothing changed.', changed: false })
    expect(project().edits).toHaveLength(1)
    await askAi('slow down scene 2', [], async () => ({ choice: 'keep', remember: true }))
    expect(project().aiHandEdits).toBe('keep')
    const decide = vi.fn()
    const r = await askAi('slow down scene 2', [], decide)
    expect(decide).not.toHaveBeenCalled()
    expect(r).toEqual({ reply: 'Kept your own changes in scene 2, so there was nothing else to change.', changed: false })
  })

  it('saves nothing when the answer changes nothing', async () => {
    await setUp()
    answer.next = { reply: 'Done.', ops: [op({ op: 'music', value: 'lofi-walk' })] }
    expect((await askAi('lo-fi music please')).changed).toBe(false)
    expect(project().edits).toHaveLength(1)
  })

  it('shows the reply when the AI asks a question instead', async () => {
    await setUp()
    answer.next = { reply: 'Which scene do you mean?', ops: [] }
    expect(await askAi('make it better there')).toEqual({ reply: 'Which scene do you mean?', changed: false })
    expect(project().edits).toHaveLength(1)
  })

  it('finds scenes by their ref after an earlier change moved them', async () => {
    await setUp()
    answer.next = { reply: 'Ok.', ops: [op({ op: 'move-scene', scene: 's3', to: 1 }), op({ op: 'camera', scene: 's3', value: 'punch' })] }
    await askAi('open with the last scene and punch in')
    expect(plan().scenes.map((s) => s.id)).toEqual(['c', 'a', 'b'])
    expect(plan().scenes[0].shots[0].motion).toBe('punch')
  })

  it('describes the vlog with scene refs and hand edits, and suggests changes from the footage', async () => {
    await setUp({ b: ['footage', 'words'] })
    const s = editState(project(), plan())
    expect(s.scenes.map((x) => [x.ref, x.line, x.handEdited])).toEqual([
      ['s1', 'Hello there', []],
      ['s2', 'Coffee first', ['footage', 'words']],
      ['s3', 'Bye now', []],
    ])
    expect(s.music).toBe('lofi-walk')
    expect(suggestionsFor(project(), plan(), useProject.getState().clips)).toEqual(['Make the intro funnier', 'Make it punchier', 'Black and white'])
    // c1 opens already; with c2 tagged and used, it's offered as the opening instead
    const clips = useProject.getState().clips.map((c) => (c.id === 'c2' ? { ...c, analysis: { ...useProject.getState().clips[0].analysis!, tags: ['coffee'] } } : c))
    expect(suggestionsFor(project(), plan(), clips)[0]).toBe('Open with the coffee')
  })
})
