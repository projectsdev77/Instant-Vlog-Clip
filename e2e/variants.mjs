// Other paths: own-voice recording, no-script montage, reload persistence, bad files.
import { chromium } from 'playwright'
import { skipTutorial } from './skipTutorial.mjs'
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.OUT ?? 'test-results'
const fixtures = readdirSync('e2e/fixtures').map((f) => join('e2e/fixtures', f)).slice(0, 4)
writeFileSync(`${OUT}/not-a-video.mp4`, 'hello')

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
await skipTutorial(context)
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

  // 2. Own voice: type lines, choose "Record my own", Make, then record over the made vlog (two takes)
  await newVlogWithClips(fixtures)
  const box = page.locator('ol textarea').first()
  await box.fill('I woke up early and grabbed coffee.')
  await box.press('Enter')
  await page.locator('ol textarea').nth(1).fill('Then I biked through the park.')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/voice$/)
  await page.getByRole('radio', { name: /Record my own/ }).click()
  await page.getByRole('button', { name: 'Make my vlog' }).click()
  await page.waitForURL(/\/record$/, { timeout: 90000 })
  ok('Make leads to the Record page')
  await page.waitForTimeout(1200)
  // Lines are a guide: change one (new footage), remove one, add one at the playhead. The length never changes.
  const length = () => page.locator('text=/\\d:\\d\\d \\/ \\d:\\d\\d/').innerText().then((t) => t.split('/')[1].trim())
  const len0 = await length()
  const lineTexts = () => page.locator('ol[aria-label="Your lines"] li').allInnerTexts()
  await page.getByRole('button', { name: /^Change “I woke up/ }).click()
  await page.getByLabel('Line', { exact: true }).fill('Coffee first, then the park.')
  await page.getByRole('button', { name: 'Save + new footage' }).click()
  await page.waitForFunction(() => document.body.innerText.includes('Coffee first, then the park.'))
  await page.getByRole('button', { name: /^Remove “Then I biked/ }).click()
  await page.waitForFunction(() => !document.body.innerText.includes('Then I biked'))
  await page.locator('[aria-label="Voice track"] [data-lane]').first().click({ position: { x: 300, y: 10 } })
  await page.getByRole('button', { name: /^Add a line at/ }).click()
  await page.getByLabel(/^New line at/).fill('And a quick ice cream stop.')
  await page.getByRole('button', { name: /^Add at/ }).click()
  await page.waitForFunction(() => document.body.innerText.includes('And a quick ice cream stop.'))
  const len1 = await length()
  if (len0 !== len1) throw new Error(`length changed ${len0} → ${len1}`)
  ok(`changed, removed and added lines; length stays ${len1} (${(await lineTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' | ')})`)
  await page.locator('ol[aria-label="Your lines"] li button').first().click() // back to 0:00
  for (const pause of [2500, 1500]) {
    await page.getByRole('main').getByRole('button', { name: 'Record', exact: true }).click()
    await page.waitForTimeout(pause)
    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    await page.waitForTimeout(1200)
  }
  await page.waitForSelector('text=2 takes recorded', { timeout: 15000 })
  ok('recorded two takes over the made vlog')
  await page.getByRole('button', { name: 'Continue to edit' }).click()
  await page.waitForURL(/\/edit(\?|$)/, { timeout: 30000 })
  const dur1 = await page.locator('text=/\\d:\\d\\d \\/ \\d:\\d\\d/').innerText()
  ok(`own-voice vlog in Edit (${dur1})`)

  // 3. Reload: the project and its edit come back
  await page.reload()
  await page.waitForSelector('ol[aria-label=Scenes] li', { timeout: 30000 })
  await page.waitForFunction(() => !document.body.innerText.includes('Mixing audio'), null, { timeout: 30000 })
  ok(`edit restored after reload (${await page.locator('ol[aria-label=Scenes] li').count()} scenes)`)

  // 4. No script: music montage
  await newVlogWithClips(fixtures)
  await page.getByRole('button', { name: 'Skip, music only' }).click()
  await page.waitForURL(/\/edit(\?|$)/, { timeout: 90000 })
  const dur2 = await page.locator('text=/\\d:\\d\\d \\/ \\d:\\d\\d/').innerText()
  ok(`no-script montage generated (${dur2}, ${await page.locator('ol[aria-label=Scenes] li').count()} scenes)`)
  await page.screenshot({ path: `${OUT}/montage.png` })
  await page.getByLabel('Edit panels').getByRole('button', { name: 'Voice', exact: true }).click()
  await page.getByRole('radio', { name: 'My own voice' }).click()
  await page.waitForURL(/\/record$/, { timeout: 30000 })
  await page.waitForSelector('text=No script, so just talk', { timeout: 15000 })
  ok('no-script vlog: My own voice in Edit opens the Record page')
  if ((await page.getByRole('radio', { name: 'Say my own thing' }).getAttribute('aria-checked')) !== 'true') throw new Error('Say my own thing should be picked when there is no script')
  await page.waitForTimeout(800)
  await page.getByRole('main').getByRole('button', { name: 'Record', exact: true }).click()
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.waitForFunction(() => /so this is my day/i.test(document.querySelector('ol[aria-label="Your lines"]')?.textContent ?? ''), null, { timeout: 30000 })
  ok(`say my own thing: the script became what was said (${(await page.locator('ol[aria-label="Your lines"] li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' | ')})`)

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
