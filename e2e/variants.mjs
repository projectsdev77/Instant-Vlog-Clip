// Other paths: own-voice recording, no-script montage, reload persistence, bad files.
import { chromium } from 'playwright'
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.OUT ?? 'test-results'
const fixtures = readdirSync('e2e/fixtures').map((f) => join('e2e/fixtures', f)).slice(0, 4)
writeFileSync(`${OUT}/not-a-video.mp4`, 'hello')

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('dialog', (d) => d.accept())
const ok = (s) => console.log(`✓ ${s}`)

async function newVlogWithClips(files) {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'New vlog' }).filter({ visible: true }).first().click()
  await page.locator('input[type=file]').setInputFiles(files)
  await page.waitForFunction((n) => document.querySelectorAll('ul li img').length >= n, files.length, { timeout: 60000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/script$/)
}

try {
  // 1. Bad file is rejected, good ones import
  await page.goto(BASE)
  await page.getByRole('button', { name: 'New vlog' }).filter({ visible: true }).first().click()
  await page.locator('input[type=file]').setInputFiles([`${OUT}/not-a-video.mp4`, fixtures[0]])
  await page.waitForSelector('text=/Couldn.t read|can.t decode/', { timeout: 30000 })
  ok('unreadable file shows an error on its tile')

  // 2. Own voice: type lines, record each with the teleprompter
  await newVlogWithClips(fixtures)
  const box = page.locator('ol input').first()
  await box.fill('I woke up early and grabbed coffee.')
  await box.press('Enter')
  await page.locator('ol input').nth(1).fill('Then I biked through the park.')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/voice$/)
  await page.getByRole('radio', { name: /Record my own/ }).click()
  await page.getByRole('button', { name: 'Open teleprompter' }).click()
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Start recording' }).click()
    await page.waitForTimeout(1800)
    await page.getByRole('button', { name: 'Stop recording' }).click()
    await page.waitForTimeout(1500)
  }
  await page.waitForSelector('text=2 of 2 lines recorded', { timeout: 15000 })
  ok('recorded both lines with the teleprompter')
  await page.getByRole('button', { name: 'Make my vlog' }).click()
  await page.waitForURL(/\/edit(\?|$)/, { timeout: 90000 })
  const dur1 = await page.locator('text=/\\d:\\d\\d \\/ \\d:\\d\\d/').innerText()
  ok(`own-voice vlog generated (${dur1})`)

  // 3. Reload: the project and its edit come back
  await page.reload()
  await page.waitForSelector('ol[aria-label=Scenes] li', { timeout: 30000 })
  await page.waitForFunction(() => !document.body.innerText.includes('Mixing audio'), null, { timeout: 30000 })
  ok(`edit restored after reload (${await page.locator('ol[aria-label=Scenes] li').count()} scenes)`)

  // 4. No script: music montage
  await newVlogWithClips(fixtures)
  await page.getByRole('button', { name: 'No script, just music' }).click()
  await page.waitForURL(/\/edit(\?|$)/, { timeout: 90000 })
  const dur2 = await page.locator('text=/\\d:\\d\\d \\/ \\d:\\d\\d/').innerText()
  ok(`no-script montage generated (${dur2}, ${await page.locator('ol[aria-label=Scenes] li').count()} scenes)`)
  await page.screenshot({ path: `${OUT}/montage.png` })

  // 5. Home lists the vlogs
  await page.goto(BASE)
  await page.waitForSelector('text=Your vlogs')
  ok(`home lists ${await page.locator('[aria-label^="More options"]').count()} vlogs`)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.screenshot({ path: `${OUT}/home-desktop.png` })
} finally {
  console.log('errors:', JSON.stringify(errors, null, 1))
  await browser.close()
}
