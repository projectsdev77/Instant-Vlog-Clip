// End-to-end flow in demo-AI mode: clips → script → voice → generate → edit → export.
import { chromium } from 'playwright'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.OUT ?? 'test-results'
const UNTIL = process.env.UNTIL ?? 'export'
const fixtures = readdirSync('e2e/fixtures').map((f) => join('e2e/fixtures', f))

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'], acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
const step = (name) => console.log(`✓ ${name}`)

async function main() {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'New vlog' }).click()
  await page.locator('input[type=file]').setInputFiles(fixtures)
  await page.waitForFunction((n) => document.querySelectorAll('ul li img').length >= n, fixtures.length - 1, { timeout: 60000 })
  await shot('1-clips')
  step('clips imported')
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.waitForURL(/\/script$/)
  await page.getByPlaceholder('A rainy Sunday').fill('a sunny Saturday in the park')
  await page.getByRole('button', { name: 'Write it for me' }).click()
  await page.waitForFunction(() => document.querySelectorAll('ol textarea').length >= 3 && [...document.querySelectorAll('ol textarea')].every((t) => t.value), null, { timeout: 30000 })
  const lines = await page.locator('ol textarea').evaluateAll((els) => els.map((e) => e.value))
  console.log('  script:', lines)
  await shot('2-script')
  step('script written')
  if (UNTIL === 'script') return
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.waitForURL(/\/voice$/)
  await page.getByRole('button', { name: 'Preview Leo' }).click()
  await page.waitForTimeout(800)
  await page.getByRole('radio', { name: /Leo/ }).click()
  await shot('3-voice')
  step('voice picked')
  if (UNTIL === 'voice') return
  await page.getByRole('button', { name: 'Make my vlog' }).click()
  await page.waitForURL(/\/generate$/)
  await page.waitForTimeout(400)
  await shot('4-generate')
  await page.waitForURL(/\/edit$/, { timeout: 90000 })
  step('vlog generated')
  await page.waitForFunction(() => !document.body.innerText.includes('Mixing audio'), null, { timeout: 30000 })
  await page.getByRole('button', { name: 'Play' }).first().click()
  await page.waitForTimeout(1200)
  await shot('5-edit-playing')
  const time = await page.locator('text=/\\d:\\d\\d \\/ \\d:\\d\\d/').innerText()
  console.log('  player time:', time)
  await page.getByRole('button', { name: 'Pause' }).first().click()
  step('preview plays')
  if (UNTIL === 'edit') return
  if (UNTIL === 'seekprobe') {
    for (const i of [1, 3]) {
      await page.locator('ol[aria-label=Scenes] li button').nth(i).click()
      await page.getByRole('button', { name: 'Close' }).click()
      await page.waitForTimeout(1500)
      const info = await page.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ rs: v.readyState, t: v.currentTime.toFixed(2), seeking: v.seeking, paused: v.paused })))
      console.log(i, JSON.stringify(info))
      await shot(`seek-${i}`)
    }
    return
  }

  await page.locator('ol[aria-label=Scenes] li button').nth(1).click()
  await page.waitForSelector('[role=dialog]')
  await shot('6-scene-sheet')
  await page.getByRole('button', { name: 'Swap' }).first().click()
  await page.locator('[role=dialog] ul.grid li button').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Close' }).click()
  step('shot swapped')
  const before = await page.locator('main p[title]').innerText()
  await page.getByLabel('Tell the AI what to change').fill('open with the sunset')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.waitForFunction((b) => document.querySelector('main p[title]')?.textContent !== b, before, { timeout: 30000 })
  console.log('  note:', await page.locator('main p[title]').innerText())
  step('tell the AI')
  await page.getByRole('button', { name: 'Undo' }).click()
  step('undo')
  for (const tab of ['Voice', 'Music', 'Style']) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await shot(`7-panel-${tab.toLowerCase()}`)
  }
  step('panels')
  if (UNTIL === 'tweak') return

  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Export video' }).click()
  for (let k = 0; k < 36; k++) {
    if (await page.locator('text=/Ready ·/').count()) break
    const txt = await page.locator('[role=dialog]').innerText().catch(() => '')
    if (k % 3 === 0) console.log('  export:', txt.replace(/\s+/g, ' ').slice(0, 120))
    await page.waitForTimeout(5000)
  }
  await page.waitForSelector('text=/Ready ·/', { timeout: 1000 })
  console.log(`  exported in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, await page.locator('text=/Ready ·/').innerText())
  await shot('8-exported')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save' }).click()
  const file = await download
  await file.saveAs(`${OUT}/${file.suggestedFilename()}`)
  console.log('  saved', file.suggestedFilename())
  step('exported')
}

try {
  await main()
} finally {
  console.log('errors:', JSON.stringify(errors, null, 1))
  await browser.close()
}
