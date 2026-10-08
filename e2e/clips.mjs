// Smoke test: create a vlog and import clips in a real Chromium.
import { chromium } from 'playwright'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.OUT ?? 'test-results'
const fixtures = readdirSync('e2e/fixtures').map((f) => join('e2e/fixtures', f))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE)
await page.getByRole('button', { name: 'New vlog' }).click()
await page.waitForURL(/\/clips$/)
await page.locator('input[type=file]').setInputFiles(fixtures)
await page.waitForFunction(() => document.querySelectorAll("ul li img").length >= 5, null, { timeout: 30000 }).catch(() => console.log("TIMEOUT"))
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/clips.png`, fullPage: true })
const tiles = await page.locator('ul li').allInnerTexts()
console.log('tiles:', JSON.stringify(tiles))
console.log('errors:', JSON.stringify(errors))
await browser.close()
