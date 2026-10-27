// Plans, account, upgrade and legal pages, against the local stand-in for the
// Edge Functions (it answers the account function like Stripe-free test mode).
import { unexpected } from './expected.mjs'
import { chromium } from 'playwright'
import { skipTutorial } from './skipTutorial.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const browser = await chromium.launch()
const ok = (m) => console.log(`✓ ${m}`)
const errors = []

// A signed-in session as supabase-js stores it (the stand-in doesn't check tokens).
const fakeSession = (context) =>
  context.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify({ access_token: 'test-token', token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'test-refresh', user }))
  })

try {
  // Signed out: plans show; starting the trial asks to sign in first
  let context = await browser.newContext({ viewport: { width: 1360, height: 900 } })
  await skipTutorial(context)
  let page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/pricing`)
  await page.waitForSelector('text=Plans')
  await page.getByRole('button', { name: /Start 7-day free trial/ }).click()
  await page.waitForSelector('text=Sign in first, then start your Pro trial.')
  ok('pricing: signed-out users are asked to sign in before checkout')
  // Sign in with a 6-digit code from the email (the stand-in's right code is 123456)
  const signIn = page.getByRole('dialog', { name: 'Sign in to keep going' })
  await signIn.getByRole('button', { name: 'Continue with Google' }).waitFor()
  await signIn.getByLabel('Email').fill('maya@example.com')
  await signIn.getByRole('button', { name: 'Email me a code' }).click()
  const codeSheet = page.getByRole('dialog', { name: 'Enter your code' })
  await codeSheet.getByText('maya@example.com').waitFor()
  await codeSheet.getByText(/Send a new code in \d+s/).waitFor()
  await codeSheet.getByLabel('6-digit code').fill('000000')
  await codeSheet.getByText('That code didn’t work. Check it, or send a new one.').waitFor()
  await codeSheet.getByLabel('6-digit code').fill('123456')
  await codeSheet.waitFor({ state: 'hidden' })
  ok('sign-in: Google button, then a 6-digit code (a wrong one says so, the right one signs in)')
  await page.goto(BASE)
  await page.getByRole('link', { name: 'Privacy' }).click()
  await page.waitForSelector('text=What stays on your device')
  await page.waitForSelector('text=Draft for legal review')
  await page.getByRole('link', { name: 'Terms' }).first().click()
  await page.waitForSelector('text=Plans and payment')
  ok('legal pages open from the footer, marked as drafts')
  await context.close()

  // Signed in: account shows Free and usage; checkout makes it Pro; delete
  context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await skipTutorial(context)
  await fakeSession(context)
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/account`)
  await page.waitForSelector('text=2 of 3')
  ok('account: Free plan with today’s usage')
  await page.getByRole('button', { name: 'See Pro' }).click()
  await page.waitForURL(/\/pricing$/)
  await page.getByRole('button', { name: /Start 7-day free trial/ }).click()
  await page.waitForURL(/\/account/)
  await page.waitForSelector('text=/Free trial until/', { timeout: 15000 })
  ok('checkout returns to the account page on the Pro trial')
  await page.getByRole('button', { name: 'Delete account…' }).click()
  await page.getByLabel('Type DELETE to confirm').fill('DELETE')
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await page.waitForSelector('text=Your account is deleted.', { timeout: 15000 })
  ok('account deleted after typing DELETE')
  await context.close()
} catch (e) {
  console.log('✗', e.message)
  process.exitCode = 1
}
console.log('errors:', JSON.stringify(unexpected(errors), null, 1))
await browser.close()
