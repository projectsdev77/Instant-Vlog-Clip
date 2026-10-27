// Account storage: a signed-in user's vlog is saved to the account, shows on
// Home on a second "device" (a fresh browser profile), opens there with its
// clips waiting to be added again, and deleting it removes it from the account.
import { unexpected } from './expected.mjs'
import { chromium } from 'playwright'
import { skipTutorial } from './skipTutorial.mjs'
import { afterClipsContinue } from './clipsContinue.mjs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const STUB = process.env.STUB_URL ?? 'http://localhost:54321'
const fixtures = readdirSync('e2e/fixtures').map((f) => join('e2e/fixtures', f))
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ok = (m) => console.log(`✓ ${m}`)
const errors = []
const account = () => fetch(`${STUB}/__stub/account`).then((r) => r.json())
const until = async (what, test, ms = 30000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await test()) return
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`timed out waiting for ${what}`)
}

/** A browser profile signed in as the same test user (the stand-in doesn't check tokens). */
async function device() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await skipTutorial(context)
  await context.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify({ access_token: 'test-token', token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'test-refresh', user }))
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return { context, page }
}

try {
  // Device 1: make a vlog while signed in
  const one = await device()
  let page = one.page
  await page.goto(BASE)
  await page.getByRole('button', { name: 'New vlog' }).filter({ visible: true }).first().click()
  await page.waitForURL(/\/clips/)
  await page.locator('input[type=file][multiple]').first().setInputFiles(fixtures)
  await page.waitForFunction((n) => document.querySelectorAll('ul li img').length >= n, fixtures.length - 1, { timeout: 60000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await afterClipsContinue(page)
  await page.getByRole('button', { name: 'Write it for me' }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('ol textarea')].length > 2 && [...document.querySelectorAll('ol textarea')].every((t) => t.value), null, { timeout: 30000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/voice$/)
  await page.getByRole('button', { name: 'Make my vlog' }).click()
  await page.waitForURL(/\/edit(\?|$)/, { timeout: 90000 })
  const id = page.url().match(/\/p\/([^/]+)\//)?.[1] ?? page.url().split('/').find((s) => s.startsWith('p_'))
  await until('the vlog to be saved to the account', async () => (await account()).vlogs.some((v) => v.id === id && ['generate', 'edit'].includes(v.step)))
  const saved = await account()
  if (!saved.files.some((f) => f.includes(`/${id}/media/`))) throw new Error(`the voice audio should be in the account: ${saved.files}`)
  if (saved.files.some((f) => f.includes('/media/m_'))) throw new Error('original clips must not be uploaded')
  ok(`a signed-in user's vlog is saved to the account (${saved.files.length} audio files, no clips)`)
  await one.context.close()

  // Device 2: the vlog is on Home, opens, and asks for the clips
  const two = await device()
  page = two.page
  await page.goto(BASE)
  const card = page.getByRole('button', { name: /In your account/ }).first()
  await card.waitFor({ timeout: 30000 })
  ok('Home on another device lists it as "In your account"')
  await card.click()
  await page.waitForURL(/\/edit(\?|$)/, { timeout: 30000 })
  const banner = page.getByRole('status').filter({ hasText: /clips? aren’t on this device|clip isn’t on this device/ })
  await banner.waitFor()
  ok(`it opens on the Edit page: ${await banner.locator('p').first().innerText()}`)
  await banner.locator('input[type=file]').setInputFiles(fixtures)
  await page.waitForSelector('text=All your clips are back.', { timeout: 30000 })
  await banner.waitFor({ state: 'hidden' })
  ok('adding the clips again puts them back in place')

  // Delete it: gone from the account too
  await page.goto(BASE)
  await page.getByRole('button', { name: /^More options for/ }).first().click()
  await page.getByRole('button', { name: 'Delete vlog' }).click()
  await page.getByText('will be removed from this device and your account').waitFor()
  await page.getByRole('button', { name: 'Delete vlog' }).click()
  await until('the account to be empty', async () => {
    const a = await account()
    return !a.vlogs.some((v) => v.id === id) && !a.files.some((f) => f.includes(`/${id}/`))
  })
  ok('deleting it removes it from the account, files included')
  await two.context.close()
} catch (e) {
  console.log('✗', e.message)
  process.exitCode = 1
}
console.log('errors:', JSON.stringify(unexpected(errors), null, 1))
await browser.close()
