import { chromium } from 'playwright'
import { skipTutorial } from './skipTutorial.mjs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
const fixtures = readdirSync('e2e/fixtures').map((f) => join('e2e/fixtures', f))
const out = process.argv[2]
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1360, height: 900 }]]) {
  const context = await browser.newContext({ viewport: vp, permissions: ['microphone'] })
  await skipTutorial(context)
  const page = await context.newPage()
  await page.goto('http://localhost:5173')
  await page.getByRole('button', { name: 'New vlog' }).filter({ visible: true }).first().click()
  await page.waitForURL(/\/clips/)
  await page.locator('input[type=file][multiple]').setInputFiles(fixtures)
  await page.waitForFunction((n) => document.querySelectorAll('ul li img').length >= n, fixtures.length - 1, { timeout: 60000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('ol textarea').first().fill('Morning coffee by the window.')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Make my vlog' }).click()
  await page.waitForURL(/\/edit/, { timeout: 90000 })
  await page.locator('ol[aria-label=Scenes] li button').first().click()
  await page.getByRole('button', { name: 'Add a line after this scene' }).click()
  await page.getByLabel('Add a line after this scene').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${out}/addline-edit-${name}.png` })
  await context.close()
}
await browser.close()
