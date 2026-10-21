// First-visit tutorial: intro slides → "Try it with sample clips" → a tip on each step → finished vlog.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.OUT ?? 'test-results'
const phone = process.env.DESKTOP !== '1'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1360, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const tag = phone ? 'phone' : 'desktop'
const shot = (name) => page.screenshot({ path: `${OUT}/tutorial-${tag}-${name}.png` })
const ok = (s) => console.log(`✓ ${s}`)
const tip = page.getByRole('dialog', { name: /^Tip:/ })
const tipTitle = async () => (await tip.getAttribute('aria-label')).replace('Tip: ', '')
const next = () => tip.getByRole('button', { name: /^(Next|Done)$/ }).click()

try {
  await page.goto(BASE)
  const intro = page.getByRole('dialog', { name: 'How it works' })
  await intro.waitFor({ timeout: 10000 })
  ok('intro opens on first visit')
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(i === 0 ? 1500 : 300)
    await shot(`intro-${i + 1}`)
    await intro.getByRole('button', { name: /^(Show me|Next)$/ }).click()
  }
  await page.waitForTimeout(300)
  await shot('intro-5')
  await intro.getByRole('button', { name: 'Try it with sample clips' }).click()

  await page.waitForURL(/\/clips$/)
  await page.waitForFunction(() => document.querySelectorAll('ul li img').length >= 3, null, { timeout: 60000 })
  ok('sample clips added')
  await tip.waitFor()
  await page.waitForTimeout(500)
  await shot('tip-clips')
  ok(`clips tip: ${await tipTitle()}`)
  await next()
  await page.waitForTimeout(400)
  ok(`clips tip: ${await tipTitle()}`)
  await shot('tip-length')
  await next()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.waitForURL(/\/script$/)
  await tip.waitFor()
  await page.waitForTimeout(500)
  ok(`script tip: ${await tipTitle()}`)
  await shot('tip-script')
  await page.getByRole('button', { name: 'Write it for me' }).click()
  await page.waitForFunction(() => document.querySelectorAll('ol textarea').length >= 3 && [...document.querySelectorAll('ol textarea')].every((t) => t.value), null, { timeout: 30000 })
  await tip.waitFor()
  await page.waitForTimeout(500)
  ok(`script tip after writing: ${await tipTitle()}`)
  await shot('tip-template')
  await next()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.waitForURL(/\/voice$/)
  await tip.waitFor()
  await page.waitForTimeout(500)
  ok(`voice tip: ${await tipTitle()}`)
  await shot('tip-voice')
  await next()
  await page.waitForTimeout(400)
  ok(`voice tip: ${await tipTitle()}`)
  await page.getByRole('button', { name: 'Make my vlog' }).click()

  await page.waitForURL(/\/edit(\?|$)/, { timeout: 90000 })
  for (let i = 0; i < 5; i++) {
    await tip.waitFor()
    await page.waitForTimeout(600)
    const title = await tipTitle()
    ok(`edit tip: ${title}`)
    await shot(`tip-edit-${i + 1}`)
    await next()
  }
  await page.waitForTimeout(500)
  if (await tip.count()) throw new Error('tour should be finished')
  ok('tour finished')
  await page.goto(BASE)
  await page.waitForTimeout(800)
  if (await page.getByRole('dialog', { name: 'How it works' }).count()) throw new Error('intro should not reopen')
  await page.getByRole('button', { name: 'How it works' }).click()
  await page.getByRole('dialog', { name: 'How it works' }).waitFor()
  ok('"How it works" reopens the intro')
  console.log('errors:', errors)
} finally {
  await browser.close()
}
