// Edit page (desktop): scene strip, Scene tab tools, version menu, length
// chip, look sliders merged into one version, No captions. Uses the stand-in AI.
import { unexpected } from './expected.mjs'
import { chromium } from 'playwright'
import { skipTutorial } from './skipTutorial.mjs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const fixtures = readdirSync('e2e/fixtures').map((f) => join('e2e/fixtures', f))
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await skipTutorial(context)
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const ok = (m) => console.log(`✓ ${m}`)
const tiles = page.locator('ol[aria-label=Scenes] li button')
const heading = () => page.getByRole('heading', { level: 2 }).first().innerText()
const version = () => page.getByTestId('version-note').innerText()
const versionNo = async () => Number((await version()).match(/Version (\d+)/)[1])

try {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'New vlog' }).filter({ visible: true }).first().click()
  await page.waitForURL(/\/clips/)
  await page.locator('input[type=file][multiple]').setInputFiles(fixtures)
  await page.waitForFunction((n) => document.querySelectorAll('ul li img').length >= n, fixtures.length - 1, { timeout: 60000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/script$/)
  await page.getByRole('button', { name: 'Write it for me' }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('ol textarea')].length > 2 && [...document.querySelectorAll('ol textarea')].every((t) => t.value), null, { timeout: 30000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/voice$/)
  await page.getByRole('button', { name: 'Make my vlog' }).click()
  await page.waitForURL(/\/edit(\?|$)/, { timeout: 90000 })
  await page.waitForFunction(() => !document.body.innerText.includes('Mixing audio'), null, { timeout: 30000 })
  if (await page.getByRole('button', { name: 'Pause' }).count()) await page.getByRole('button', { name: 'Pause' }).first().click()
  await tiles.first().waitFor()
  const n0 = await tiles.count()
  if (!(await heading()).startsWith('Scene 1')) throw new Error('Scene 1 should be open at first')
  ok(`edit page opens on scene 1 of ${n0}`)

  // Strip and previous/next
  await tiles.nth(2).click()
  if (!(await heading()).startsWith('Scene 3')) throw new Error('clicking tile 3 should open scene 3')
  await page.getByRole('button', { name: 'Next scene' }).click()
  await page.getByRole('button', { name: 'Previous scene' }).click()
  await page.getByRole('button', { name: 'Previous scene' }).click()
  if (!(await heading()).startsWith('Scene 2')) throw new Error('previous/next should land on scene 2')
  ok('strip opens a scene; previous and next step through them')

  // Reorder with Alt+→ on a tile
  const label1 = await tiles.nth(0).getAttribute('aria-label')
  await tiles.nth(0).focus()
  await page.keyboard.press('Alt+ArrowRight')
  await page.waitForFunction((l) => document.querySelectorAll('ol[aria-label=Scenes] li button')[1]?.getAttribute('aria-label')?.endsWith(l.replace(/^Scene 1/, '')), label1, { timeout: 10000 })
  ok('Alt+→ moves a scene one place later')
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.waitForFunction((l) => document.querySelectorAll('ol[aria-label=Scenes] li button')[0]?.getAttribute('aria-label') === l, label1, { timeout: 10000 })

  // Reorder by dragging with the mouse
  const a = await tiles.nth(0).boundingBox()
  const c = await tiles.nth(2).boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  for (let k = 1; k <= 12; k++) await page.mouse.move(a.x + a.width / 2 + ((c.x + c.width / 2 - a.x - a.width / 2) * k) / 12, a.y + a.height / 2)
  await page.mouse.up()
  await page.waitForFunction((l) => document.querySelectorAll('ol[aria-label=Scenes] li button')[0]?.getAttribute('aria-label') !== l, label1, { timeout: 10000 })
  ok('dragging a tile reorders the scenes')
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.waitForFunction((l) => document.querySelectorAll('ol[aria-label=Scenes] li button')[0]?.getAttribute('aria-label') === l, label1, { timeout: 10000 })

  // Duplicate, add, delete
  await tiles.nth(0).click()
  await page.getByRole('button', { name: 'Duplicate scene' }).click()
  await page.waitForSelector('text=Added a copy as scene 2.')
  if ((await tiles.count()) !== n0 + 1) throw new Error('duplicate should add one scene')
  if (!(await tiles.nth(1).getAttribute('aria-label')).includes('music only')) throw new Error('the copy should be music only')
  await page.getByRole('button', { name: 'Add a scene' }).click()
  await page.waitForFunction((n) => document.querySelectorAll('ol[aria-label=Scenes] li button').length === n, n0 + 2, { timeout: 10000 })
  if (!(await heading()).startsWith('Scene 2')) throw new Error('the new scene should open')
  await page.getByRole('button', { name: 'Delete scene' }).click()
  await page.waitForFunction((n) => document.querySelectorAll('ol[aria-label=Scenes] li button').length === n, n0 + 1, { timeout: 10000 })
  ok('duplicate (music only copy), add and delete a scene')

  // Clip: trim with the keyboard, split, hold the last frame
  await tiles.nth(0).click()
  const start = page.getByRole('slider', { name: 'Trim start' })
  const was = Number(await start.getAttribute('aria-valuenow'))
  await start.focus()
  await page.keyboard.down('ArrowRight')
  await page.keyboard.up('ArrowRight')
  await page.waitForFunction((w) => Number(document.querySelector('[aria-label="Trim start"]')?.getAttribute('aria-valuenow')) > w + 0.05, was, { timeout: 15000 })
  ok(`trim handle moves by 0.1 s (${was} → ${Number(await page.getByRole('slider', { name: 'Trim start' }).getAttribute('aria-valuenow'))})`)
  await page.getByRole('button', { name: /^Split/ }).click()
  await page.getByRole('tab', { name: /^Shot 2/ }).waitFor()
  ok('split makes two shots, with a shot switcher')
  await page.getByRole('tab', { name: /^Shot 2/ }).click()
  await page.getByRole('button', { name: /Hold last frame|Freeze at playhead/ }).click()
  await page.getByRole('tab', { name: /^Shot 3/ }).waitFor()
  ok('hold / freeze adds a frozen shot')

  // Motion: an option under More, then back to the main four
  await page.getByLabel('More speed options').selectOption({ label: 'Montage' })
  await page.waitForFunction(() => document.querySelector('select[aria-label="More speed options"]')?.value === 'montage')
  await page.getByRole('radiogroup', { name: 'Speed' }).getByRole('radio', { name: '2×' }).click()
  await page.getByRole('radiogroup', { name: 'Speed' }).getByRole('radio', { name: '2×', checked: true }).waitFor()
  await page.getByLabel('More camera options').selectOption({ label: 'Shake' })
  await page.waitForFunction(() => document.querySelector('select[aria-label="More camera options"]')?.value === 'shake')
  ok('effects under More (Montage, Shake) still work beside the main options')

  // Version menu: open an older version
  const vNow = await versionNo()
  await page.getByTestId('version-note').click()
  await page.getByRole('listbox', { name: 'Versions' }).getByRole('option', { name: /^Version 1/ }).click()
  await page.waitForFunction(() => document.querySelector('[data-testid=version-note]')?.textContent?.startsWith('Version 1'))
  await page.getByRole('button', { name: 'Redo' }).waitFor()
  ok(`version menu opens version 1 (was ${vNow})`)

  // Look: dragging a slider makes one version, not one per step
  await page.getByRole('tab', { name: 'Look' }).click()
  await page.getByRole('button', { name: /Fine-tune/ }).click()
  const v1 = await versionNo()
  const bright = page.getByRole('slider', { name: 'Brightness' })
  await bright.focus()
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  const v2 = await versionNo()
  if (v2 !== v1 + 1) throw new Error(`six quick slider steps should make one version (${v1} → ${v2})`)
  ok('six quick slider steps save one version')

  // Text: No captions
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByRole('button', { name: 'No captions captions' }).click()
  await page.getByRole('button', { name: 'No captions captions', pressed: true }).waitFor()
  ok('No captions can be picked')

  // Shorter, 20s: on the device, no AI call
  await page.getByRole('button', { name: 'Shorter, 20s' }).click()
  await page.waitForSelector('text=/Now (about 20s|\\d+s)/', { timeout: 15000 })
  ok(`"Shorter, 20s": ${(await page.locator('text=/Now (about 20s|\\d+s)/').first().innerText()).slice(0, 60)}`)

  // Previews: a voice sample and a music sample play and stop
  await page.getByRole('tab', { name: 'Music' }).click()
  await page.getByRole('button', { name: 'Preview Sunny Day' }).click()
  await page.getByRole('button', { name: 'Stop Sunny Day' }).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Stop Sunny Day' }).click()
  await page.getByRole('tab', { name: 'Voice' }).click()
  await page.getByRole('button', { name: /^Preview / }).first().click()
  await page.getByRole('button', { name: /^Stop / }).first().waitFor({ timeout: 15000 })
  ok('music and voice previews play and stop')
} catch (e) {
  console.log('✗', e.message)
  await page.screenshot({ path: 'test-results/edit-fail.png' })
  process.exitCode = 1
}
console.log('errors:', JSON.stringify(unexpected(errors), null, 1))
await browser.close()
