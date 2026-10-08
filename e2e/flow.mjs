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
  step('generate opened')
}

try {
  await main()
} finally {
  console.log('errors:', JSON.stringify(errors, null, 1))
  await browser.close()
}
