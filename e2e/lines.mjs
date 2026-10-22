// Per-line voice tools in Edit (AI voice): mute a line, read it again in another delivery, add a new line.
import { chromium } from 'playwright'
import { skipTutorial } from './skipTutorial.mjs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const fixtures = readdirSync('e2e/fixtures').map((f) => join('e2e/fixtures', f))
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 1360, height: 900 } })
await skipTutorial(context)
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const synth = []
page.on('request', (r) => {
  const body = r.method() === 'POST' ? r.postData() : null
  if (body?.includes('"action":"synthesize"')) synth.push(JSON.parse(body).payload)
})
const ok = (m) => console.log(`✓ ${m}`)
const scenes = () => page.locator('ol[aria-label=Scenes] li').count()

try {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'New vlog' }).filter({ visible: true }).first().click()
  await page.waitForURL(/\/clips/)
  await page.locator('input[type=file][multiple]').setInputFiles(fixtures)
  await page.waitForFunction((n) => document.querySelectorAll('ul li img').length >= n, fixtures.length - 1, { timeout: 60000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/script$/)
  const box = page.locator('ol textarea').first()
  await box.fill('Morning coffee by the window.')
  await box.press('Enter')
  await page.locator('ol textarea').nth(1).fill('Then a long walk in the park.')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/voice$/)
  await page.getByRole('button', { name: 'Make my vlog' }).click()
  await page.waitForURL(/\/edit(\?|$)/, { timeout: 90000 })
  await page.waitForSelector('ol[aria-label=Scenes] li')
  const before = await scenes()
  ok(`AI-voice vlog made (${before} scenes)`)

  // open the first narrated scene
  await page.locator('ol[aria-label=Scenes] li button').first().click()
  await page.getByRole('button', { name: 'Mute voice' }).click()
  await page.waitForSelector('text=The AI voice skips this line')
  ok('muted the line (caption only)')
  await page.getByRole('button', { name: 'Turn voice on' }).click()
  await page.waitForSelector('role=group[name="Read it"]')
  ok('voice back on')
  await page.screenshot({ path: 'test-results/lines-scene.png' })

  const n = synth.length
  const isSynth = (r) => r.postData()?.includes('"action":"synthesize"')
  await Promise.all([page.waitForRequest(isSynth), page.getByRole('group', { name: 'Read it' }).getByRole('button', { name: 'Calmer' }).click()])
  const calm = synth.slice(n).find((p) => p.delivery === 'calm')
  if (!calm || typeof calm.seed !== 'number') throw new Error('no calm re-read request: ' + JSON.stringify(synth.slice(n)))
  ok('read again calmer (new seed)')
  const m = synth.length
  await page.waitForFunction(() => !document.querySelector('[role=group][aria-label="Read it"] button:disabled'))
  await Promise.all([page.waitForRequest(isSynth), page.getByRole('group', { name: 'Read it' }).getByRole('button', { name: 'Read again' }).click()])
  const again = synth.slice(m).find((p) => p.delivery === 'calm' && p.seed !== calm.seed)
  if (!again) throw new Error('Read again did not ask for a new take')
  ok('read again (same delivery, new take)')

  await page.waitForFunction(() => !document.querySelector('[role=group][aria-label="Read it"] button:disabled'))
  await page.getByRole('button', { name: 'Add a line after this scene' }).click()
  await page.getByLabel('Add a line after this scene').fill('A quick stop for ice cream.')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForSelector('text=/Added a line/', { timeout: 30000 })
  await page.waitForFunction(() => document.querySelector('#scene-line')?.value === 'A quick stop for ice cream.', null, { timeout: 30000 })
  await page.getByRole('button', { name: 'All scenes' }).click()
  const after = await scenes()
  if (after !== before + 1) throw new Error(`expected ${before + 1} scenes, got ${after}`)
  ok(`added a new line as a scene (${before} → ${after} scenes)`)

  // Undo brings the words back, not just the scenes
  await page.waitForTimeout(800)
  if (await page.getByRole('button', { name: 'All scenes' }).isVisible()) await page.getByRole('button', { name: 'All scenes' }).click()
  await page.locator('ol[aria-label=Scenes] li button').first().click()
  await page.getByLabel('Narration').fill('A totally different line.')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForSelector('text=Rewrote a line')
  await page.getByRole('button', { name: 'All scenes' }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click()
  await page.waitForFunction(() => document.querySelector('ol[aria-label=Scenes]')?.textContent?.includes('Morning coffee by the window.'), null, { timeout: 15000 })
  ok('undo restores the old words of an edited line')
  await page.screenshot({ path: 'test-results/lines.png' })

  // A shot changed by hand is marked "Yours" and survives Tell the AI (checked below)
  await page.locator('ol[aria-label=Scenes] li button').first().click()
  await page.getByRole('radiogroup', { name: 'Clip sound' }).first().getByRole('radio', { name: 'Full' }).click()
  await page.waitForSelector('text=You picked this footage')
  await page.getByRole('button', { name: 'All scenes' }).click()
  if (!(await page.locator('ol[aria-label=Scenes] li').first().innerText()).includes('Yours')) throw new Error('scene not marked Yours')
  ok('a shot changed by hand marks its scene as yours')

  // Title: turn it off; it stays off after Tell the AI
  await page.getByLabel('Edit panels').getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByRole('radio', { name: 'Off' }).click()
  await page.waitForSelector('text=Title hidden')
  await page.getByLabel('Edit panels').getByRole('button', { name: 'Scenes', exact: true }).click()
  await page.getByPlaceholder(/Tell the AI/).fill('make it punchier')
  await page.getByPlaceholder(/Tell the AI/).press('Enter')
  await page.waitForSelector('text=/make it punchier/', { timeout: 60000 })
  await page.getByLabel('Edit panels').getByRole('button', { name: 'Text', exact: true }).click()
  if ((await page.getByRole('radio', { name: 'Off' }).getAttribute('aria-checked')) !== 'true') throw new Error('title came back after Tell the AI')
  ok('title turned off, and stays off after Tell the AI')
  await page.getByLabel('Edit panels').getByRole('button', { name: 'Scenes', exact: true }).click()
  if (!(await page.locator('ol[aria-label=Scenes]').innerText()).includes('Yours')) throw new Error('your scene was lost after Tell the AI')
  ok('your scene is kept after Tell the AI')
} catch (e) {
  console.log('✗', e.message)
  await page.screenshot({ path: 'test-results/lines-fail.png' })
  process.exitCode = 1
}
console.log('errors:', errors)
await browser.close()
