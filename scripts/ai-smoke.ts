// Runs the real AI prompts against a sample day and checks the answers.
// Usage (Deno):
//   GEMINI_API_KEY=... deno run -A scripts/ai-smoke.ts
//   AI_PROVIDER=claude ANTHROPIC_API_KEY=... deno run -A scripts/ai-smoke.ts
// Optional: pass a JPEG contact sheet to also test clip analysis:
//   deno run -A scripts/ai-smoke.ts path/to/sheet.jpg
import type { CatalogEntry, PlanResponse, ScriptResponse, AnalyzeClipResponse } from '../supabase/functions/_shared/contracts.ts'
import { ANALYZE_SYSTEM, analyzeChecklist, analyzeUserText, PLAN_SYSTEM, planChecklist, planUserText, SCRIPT_SYSTEM, scriptChecklist, scriptUserText } from '../supabase/functions/_shared/prompts.ts'
import { analyzeClipSchema, planSchema, scriptSchema } from '../supabase/functions/_shared/schemas.ts'
import { currentProvider, generateJson } from '../supabase/functions/ai/llm.ts'

const catalog: CatalogEntry[] = [
  { clipId: 'c1', durationSec: 9.2, description: 'Latte being poured into a white cup at a café counter', tags: ['coffee', 'cafe', 'morning'], shotType: 'closeup', mustInclude: false, unusable: false, moments: [{ start: 1, end: 4.5, score: 0.9, why: 'pour in focus' }] },
  { clipId: 'c2', durationSec: 14, description: 'Riding a bike along a tree-lined path by a lake, first person', tags: ['bike', 'lake', 'park'], shotType: 'pov', mustInclude: true, unusable: false, moments: [{ start: 2, end: 7, score: 0.85, why: 'smooth stretch' }, { start: 8, end: 12, score: 0.7, why: 'lake view' }] },
  { clipId: 'c3', durationSec: 6.5, description: 'A person laughing at a picnic blanket with sandwiches', tags: ['picnic', 'friends', 'food'], shotType: 'wide', mustInclude: false, unusable: false, moments: [{ start: 0.5, end: 4, score: 0.8, why: 'laughing' }] },
  { clipId: 'c4', durationSec: 3.1, description: 'Blurry shot of the ground', tags: ['ground'], shotType: 'other', mustInclude: false, unusable: true, moments: [{ start: 0, end: 2, score: 0.1, why: 'accidental' }] },
  { clipId: 'c5', durationSec: 11, description: 'Sunset over the lake with orange sky', tags: ['sunset', 'lake', 'sky'], shotType: 'wide', mustInclude: false, unusable: false, moments: [{ start: 3, end: 8, score: 0.95, why: 'colour peak' }] },
]

const problems: string[] = []
const check = (ok: boolean, msg: string) => ok || problems.push(msg)

console.log(`Provider: ${currentProvider()}\n`)

const scriptReq = { mode: 'write' as const, language: 'en', title: '', prompt: 'a slow Saturday at the lake', lines: [], targetSec: 30 as const, vibe: 'chill', catalog }
let t = performance.now()
const script = await generateJson<ScriptResponse>({ system: SCRIPT_SYSTEM, effort: 'medium', schema: scriptSchema, checklist: scriptChecklist(scriptReq), parts: [{ type: 'text', text: scriptUserText(scriptReq) }] })
console.log(`Script (${((performance.now() - t) / 1000).toFixed(1)}s): ${script.title}`)
script.lines.forEach((l, i) => console.log(`  ${i + 1}. [${l.purpose}] ${l.text}`))
const words = script.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0)
check(words >= 50 && words <= 100, `script length ${words} words (target ~75)`)
check(script.lines[0]?.purpose === 'hook', 'first line is not a hook')
check(script.lines.at(-1)?.purpose === 'outro', 'last line is not an outro')
script.lines.forEach((l, i) => check(l.text.split(/\s+/).length <= 15, `line ${i + 1} is over 15 words`))
check(script.lines.some((l) => /bike|cycl|ride/i.test(l.text)), 'must-include bike clip has no line')

const lines = script.lines.map((l, i) => ({ lineId: `l${i + 1}`, text: l.text, visualIntent: l.visualIntent, sceneSec: Math.round((l.text.split(/\s+/).length / 2.6 + 0.35) * 100) / 100 }))
const planReq = { aspect: '9:16' as const, vibe: 'chill', narrated: true, lines, targetSec: 30, catalog }
t = performance.now()
const plan = await generateJson<PlanResponse>({ system: PLAN_SYSTEM, effort: 'medium', schema: planSchema, checklist: planChecklist(planReq), parts: [{ type: 'text', text: planUserText(planReq) }] })
console.log(`\nPlan (${((performance.now() - t) / 1000).toFixed(1)}s): ${plan.note}`)
const byId = new Map(catalog.map((c) => [c.clipId, c]))
check(plan.scenes.length === lines.length, `plan has ${plan.scenes.length} scenes for ${lines.length} lines`)
plan.scenes.forEach((s, i) => {
  const want = lines[i]
  const total = s.shots.reduce((a, x) => a + (x.out - x.in), 0)
  console.log(`  ${i + 1}. ${s.lineId}: ${s.shots.map((x) => `${x.clipId} ${x.in}-${x.out}`).join(', ')}  (${total.toFixed(2)}s / ${want?.sceneSec}s)`)
  check(s.lineId === want?.lineId, `scene ${i + 1} lineId "${s.lineId}" should be "${want?.lineId}"`)
  check(Math.abs(total - (want?.sceneSec ?? 0)) <= 0.15, `scene ${i + 1} lasts ${total.toFixed(2)}s, should be ${want?.sceneSec}s`)
  for (const x of s.shots) {
    const c = byId.get(x.clipId)
    check(!!c, `scene ${i + 1} uses unknown clip ${x.clipId}`)
    if (c) check(x.in >= 0 && x.out <= c.durationSec && x.in < x.out, `scene ${i + 1} shot ${x.clipId} ${x.in}-${x.out} is outside 0-${c.durationSec}s`)
    check(x.clipId !== 'c4', `scene ${i + 1} uses the unusable clip`)
  }
})
check(plan.scenes[0]?.shots[0]?.transitionIn === 'cut', 'first shot does not start with a cut')

const sheet = Deno.args[0]
if (sheet) {
  const bytes = await Deno.readFile(sheet)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const req = { clipId: 'x', fileName: sheet, durationSec: 12, contactSheetBase64: btoa(bin), frameTimes: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5], speechRatio: 0 }
  t = performance.now()
  const a = await generateJson<AnalyzeClipResponse>({ system: ANALYZE_SYSTEM, effort: 'low', schema: analyzeClipSchema, maxTokens: 8000, checklist: analyzeChecklist(req), parts: [{ type: 'image', mimeType: 'image/jpeg', base64: req.contactSheetBase64 }, { type: 'text', text: analyzeUserText(req) }] })
  console.log(`\nAnalysis (${((performance.now() - t) / 1000).toFixed(1)}s): ${a.description} [${a.shotType}] tags: ${a.tags.join(', ')}`)
  a.moments.forEach((m) => {
    console.log(`  ${m.start}-${m.end}s score ${m.score}: ${m.why}`)
    check(m.start >= 0 && m.end <= req.durationSec && m.start < m.end, `moment ${m.start}-${m.end} is outside the clip`)
  })
}

console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nAll checks passed.')
