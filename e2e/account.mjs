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
  await page.waitForSelector('text=Create an account or log in to start your Pro trial.')
  ok('pricing: signed-out users are asked to sign in before checkout')
  // The pop-up: sign up first (with Google, or email and password confirmed by email)
  const pop = page.getByRole('dialog', { name: 'Create your account' })
  await pop.getByText('Create an account or log in to start your Pro trial.').waitFor()
  await pop.getByRole('button', { name: 'Sign up with Google' }).waitFor()
  await pop.getByLabel('Email').fill('maya@example.com')
  await pop.getByLabel('Password', { exact: true }).fill('short')
  await pop.getByRole('button', { name: 'Create account' }).click()
  await pop.getByText('Your password doesn’t meet all the requirements yet.').waitFor()
  await pop.getByLabel('Password', { exact: true }).fill('alongpassword')
  if ((await pop.getByRole('list', { name: 'Password needs' }).innerText()).match(/\(done\)/g)?.length !== 1) throw new Error('only the length rule should be met')
  await pop.getByLabel('Password', { exact: true }).fill('Along-passw0rd')
  await pop.getByRole('list', { name: 'Password needs' }).getByText('(needed)').first().waitFor({ state: 'detached' })
  await pop.getByRole('button', { name: 'Create account' }).click()
  await pop.getByTestId('auth-sent').getByText('We sent a confirmation link to').waitFor()
  await pop.getByTestId('auth-sent').getByText(/Send it again in \d+s/).waitFor()
  await page.keyboard.press('Escape')
  ok('sign up: Google, or email and a password that meets the rules (ticked off as typed), confirmed by email')

  // The pages: Sign up in the header; an address that has an account; switching to log in; a wrong password; forgot password
  await page.getByRole('button', { name: 'Sign up' }).first().click()
  await page.waitForURL(/\/signup\?next=%2Fpricing/)
  await page.getByRole('heading', { name: 'Create your account' }).waitFor()
  await page.getByLabel('Email').fill('taken@example.com')
  await page.getByLabel('Password', { exact: true }).fill('Along-passw0rd')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByText('There’s already an account with this email. Log in instead.').waitFor()
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click()
  await page.waitForURL(/\/login\?next=%2Fpricing/)
  await page.getByRole('heading', { name: 'Log in' }).waitFor()
  await page.getByRole('button', { name: 'Log in with Google' }).waitFor()
  await page.getByLabel('Email').fill('maya@example.com')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click()
  await page.getByText('Wrong email or password.').waitFor()
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await page.getByRole('heading', { name: 'Reset your password' }).waitFor()
  await page.getByRole('button', { name: 'Send link' }).click()
  await page.getByText('We sent a link to choose a new password to').waitFor()
  await page.getByRole('button', { name: 'Back to log in' }).click()
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-9')
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click()
  await page.waitForURL(/\/pricing$/)
  await page.getByRole('link', { name: /maya@example.com|Account/ }).first().waitFor()
  ok('log in: pages for sign up and log in, existing account caught, wrong password, forgot password, then logged in and back on Plans')
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
  // The link from the "choose a new password" email signs in for that step
  context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await skipTutorial(context)
  await fakeSession(context)
  page = await context.newPage()
  await page.goto(`${BASE}/reset-password`)
  await page.getByLabel('New password', { exact: true }).fill('short')
  await page.getByRole('button', { name: 'Save password' }).click()
  await page.getByText('Your password doesn’t meet all the requirements yet.').waitFor()
  await page.getByLabel('New password', { exact: true }).fill('A-new-passw0rd')
  await page.getByRole('button', { name: 'Save password' }).click()
  await page.getByText('Your password is changed.').waitFor()
  await context.close()
  ok('reset password: a new password is saved from the emailed link')
} catch (e) {
  console.log('✗', e.message)
  process.exitCode = 1
}
console.log('errors:', JSON.stringify(unexpected(errors), null, 1))
await browser.close()
