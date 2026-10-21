// Effects flow (uses the real AI): TikTok template → generated edit has transitions/moves/speed → split, freeze, speed, camera → export.
// FIX=public/examples uses the real stock footage instead of the test patterns.
import { chromium } from 'playwright'
import { skipTutorial } from './skipTutorial.mjs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
const dir = process.env.FIX ?? 'e2e/fixtures'; const fixtures = readdirSync(dir).filter((f) => f.endsWith('.webm')).map((f) => join(dir, f))
const SP = process.env.OUT ?? 'test-results'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
await skipTutorial(context)
const page = await context.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const step = (s) => console.log('✓', s)
await page.goto('http://localhost:5173')
await page.getByRole('button', { name: 'New vlog' }).filter({ visible: true }).first().click()
await page.locator('input[type=file]').setInputFiles(fixtures)
await page.waitForFunction((n) => document.querySelectorAll('ul li img').length >= n, fixtures.length - 1, { timeout: 60000 })
await page.getByRole('button', { name: '15s', exact: true }).click()
await page.getByRole('button', { name: 'Continue' }).click()
await page.waitForURL(/\/script$/)
await page.getByLabel('What’s it about?').fill('a sunny Saturday in the park')
await page.getByRole('button', { name: 'TikTok fast cuts' }).click()
await page.screenshot({ path: `${SP}/fx-script.png` })
await page.getByRole('button', { name: 'Write it for me' }).click()
await page.waitForFunction(() => document.querySelectorAll('ol textarea').length >= 3 && [...document.querySelectorAll('ol textarea')].every((t) => t.value), null, { timeout: 30000 })
await page.getByRole('button', { name: 'Continue' }).click()
await page.waitForURL(/\/voice$/)
await page.getByRole('button', { name: 'Make my vlog' }).click()
await page.waitForURL(/\/edit(\?|$)/, { timeout: 90000 })
await page.waitForFunction(() => !document.body.innerText.includes('Mixing audio'), null, { timeout: 30000 })
step('generated: ' + (await page.locator('text=/\\d:\\d\\d \\/ \\d:\\d\\d/').first().innerText()))
// grab a few preview frames
for (const ms of [600, 900, 1300]) { await page.waitForTimeout(ms); await page.locator('canvas').first().screenshot({ path: `${SP}/fx-frame-${ms}.png` }) }
if (await page.getByRole('button', { name: 'Pause' }).count()) await page.getByRole('button', { name: 'Pause' }).first().click()
await page.waitForTimeout(800)
const plan = await page.evaluate(async () => {
  const req = indexedDB.open('instant-vlog-clip')
  return await new Promise((res) => { req.onsuccess = () => { const db = req.result; const names = [...db.objectStoreNames]; const tx = db.transaction(names.includes('projects') ? 'projects' : names[0]); const st = tx.objectStore(names.includes('projects') ? 'projects' : names[0]); const g = st.getAll(); g.onsuccess = () => { const p = g.result[g.result.length - 1]; const e = p.edits[p.currentEdit]; res({ template: e.templateId, look: e.look?.filter, shots: e.scenes.flatMap((s) => s.shots.map((x) => [x.transitionIn, x.motion ?? 'none', x.speed ?? 1, x.ramp ?? 'none'].join('/'))) }) } } ; req.onerror = () => res(null) })
})
console.log(JSON.stringify(plan))
// export
await page.getByRole('button', { name: 'Export video' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Export video' }).click()
await page.waitForSelector('text=/Ready ·/', { timeout: 240000 })
step('exported: ' + (await page.locator('text=/Ready ·/').innerText()))
const download = page.waitForEvent('download')
await page.getByRole('button', { name: /Save to Photos|Download video/ }).click()
await (await download).saveAs(`${SP}/fx.webm`)
console.log('errors', errors)
await browser.close()
