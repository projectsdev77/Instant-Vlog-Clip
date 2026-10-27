// Per-line voice tools in Edit (AI voice): mute a line, read it again in another delivery, add a new line.
import { unexpected } from './expected.mjs'
import { chromium } from 'playwright'
import { skipTutorial } from './skipTutorial.mjs'
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterClipsContinue } from './clipsContinue.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const fixtures = readdirSync('e2e/fixtures').map((f) => join('e2e/fixtures', f))
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 1360, height: 900 } })
await skipTutorial(context)
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const synth = []
page.on('request', (r) => {
  const body = r.method() === 'POST' ? r.postData() : null
  if (body?.includes('"action":"synthesize"')) synth.push(JSON.parse(body).payload)
})
const ok = (m) => console.log(`✓ ${m}`)
const scenes = () => page.locator('ol[aria-label=Scenes] li').count()

try {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'New vlog' }).filter({ visible: true }).first().click()
  await page.waitForURL(/\/clips/)
  await page.locator('input[type=file][multiple]').setInputFiles(fixtures)
  await page.waitForFunction((n) => document.querySelectorAll('ul li img').length >= n, fixtures.length - 1, { timeout: 60000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await afterClipsContinue(page)
  const box = page.locator('ol textarea').first()
  await box.fill('Morning coffee by the window.')
  await box.press('Enter')
  await page.locator('ol textarea').nth(1).fill('Then a long walk in the park.')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/voice$/)
  await page.getByRole('button', { name: 'Make my vlog' }).click()
  await page.waitForURL(/\/edit(\?|$)/, { timeout: 90000 })
  await page.waitForSelector('ol[aria-label=Scenes] li')
  const before = await scenes()
  ok(`AI-voice vlog made (${before} scenes)`)

  // open the first narrated scene
  await page.locator('ol[aria-label=Scenes] li button').first().click()
  await page.getByRole('button', { name: 'Mute voice' }).click()
  await page.waitForSelector('text=The AI voice skips this line')
  ok('muted the line (caption only)')
  await page.getByRole('button', { name: 'Turn voice on' }).click()
  await page.waitForSelector('role=radiogroup[name="Read it"]')
  ok('voice back on')
  await page.screenshot({ path: 'test-results/lines-scene.png' })

  const n = synth.length
  const isSynth = (r) => r.postData()?.includes('"action":"synthesize"')
  await Promise.all([page.waitForRequest(isSynth), page.getByRole('radiogroup', { name: 'Read it' }).getByRole('radio', { name: 'Calmer' }).click()])
  const calm = synth.slice(n).find((p) => p.delivery === 'calm')
  if (!calm || typeof calm.seed !== 'number') throw new Error('no calm re-read request: ' + JSON.stringify(synth.slice(n)))
  ok('read again calmer (new seed)')
  const m = synth.length
  await page.waitForFunction(() => !document.querySelector('[role=radiogroup][aria-label="Read it"] button:disabled'))
  await Promise.all([page.waitForRequest(isSynth), page.getByRole('button', { name: 'Read again' }).click()])
  const again = synth.slice(m).find((p) => p.delivery === 'calm' && p.seed !== calm.seed)
  if (!again) throw new Error('Read again did not ask for a new take')
  ok('read again (same delivery, new take)')

  // A new scene (from the strip's + tile), then its words
  await page.waitForFunction(() => !document.querySelector('[role=radiogroup][aria-label="Read it"] button:disabled'))
  await page.getByRole('button', { name: 'Add a scene' }).click()
  await page.getByRole('heading', { name: /Scene 2/ }).waitFor()
  const said = page.getByRole('textbox', { name: 'What’s said' })
  await said.fill('A quick stop for ice cream.')
  await said.press('Enter')
  await page.waitForSelector('ol[aria-label=Scenes] button[aria-label="Scene 2: A quick stop for ice cream."]', { timeout: 30000 })
  const after = await scenes()
  if (after !== before + 1) throw new Error(`expected ${before + 1} scenes, got ${after}`)
  ok(`added a new scene with a line (${before} → ${after} scenes)`)

  // Undo brings the words back, not just the scenes
  await page.waitForTimeout(800)
  await page.locator('ol[aria-label=Scenes] li button').first().click()
  await said.fill('A totally different line.')
  await said.press('Enter')
  await page.waitForSelector('ol[aria-label=Scenes] button[aria-label="Scene 1: A totally different line."]', { timeout: 30000 })
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click()
  await page.waitForSelector('ol[aria-label=Scenes] button[aria-label="Scene 1: Morning coffee by the window."]', { timeout: 15000 })
  ok('undo restores the old words of an edited line')
  await page.screenshot({ path: 'test-results/lines.png' })

  // Title: turn it off; it stays off after Ask AI
  await page.getByRole('tab', { name: 'Text', exact: true }).click()
  await page.getByRole('radio', { name: 'Off' }).click()
  await page.getByRole('radio', { name: 'Off', checked: true }).waitFor()
  await page.getByPlaceholder(/Ask AI/).fill('make it punchier')
  await page.getByPlaceholder(/Ask AI/).press('Enter')
  await page.getByTestId('ai-reply').waitFor({ timeout: 60000 })
  if ((await page.getByRole('radio', { name: 'Off' }).getAttribute('aria-checked')) !== 'true') throw new Error('title came back after Ask AI')
  ok('title turned off, and stays off after Ask AI')

  // The user's own edit: Ask AI asks before changing it, and can remember the answer
  await page.locator('ol[aria-label=Scenes] li button').first().click()
  const sound = page.getByRole('radiogroup', { name: 'Clip sound' }).first()
  await sound.getByRole('radio', { name: 'Full' }).click()
  await sound.getByRole('radio', { name: 'Full', checked: true }).waitFor()
  const ask = async (text) => {
    await page.getByPlaceholder(/Ask AI|Answer/).fill(text)
    await page.getByPlaceholder(/Ask AI|Answer/).press('Enter')
  }
  const sheet = page.getByRole('dialog', { name: 'Keep your changes?' })
  await ask('mute the first scene')
  await sheet.getByText('You changed the sound in scene 1 yourself').waitFor({ timeout: 30000 })
  await sheet.getByRole('button', { name: 'Keep my changes' }).click()
  await page.getByTestId('ai-reply').filter({ hasText: 'Kept your own changes in scene 1' }).waitFor()
  await sound.getByRole('radio', { name: 'Full', checked: true }).waitFor()
  ok('Ask AI asks before changing your own edit, and "Keep my changes" keeps it')
  await ask('mute the first scene')
  await sheet.getByLabel('Don’t ask again for this vlog').check()
  await sheet.getByRole('button', { name: 'Let AI change them' }).click()
  await sound.getByRole('radio', { name: 'Off', checked: true }).waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Ask me each time' }).waitFor()
  await sound.getByRole('radio', { name: 'Full' }).click()
  await ask('mute the first scene')
  await sound.getByRole('radio', { name: 'Off', checked: true }).waitFor({ timeout: 30000 })
  if (await sheet.isVisible()) throw new Error('the remembered answer should not ask again')
  await page.getByRole('button', { name: 'Ask me each time' }).click()
  ok('"Let AI change them" with Don’t ask again remembers; "Ask me each time" brings the question back')

  // Own music: confirm rights, upload a song, pick its start; export without music
  const rate = 22050, secs = 12, samples = rate * secs
  const wav = Buffer.alloc(44 + samples * 2)
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 330) * 6000), 44 + i * 2)
  writeFileSync('test-results/my-song.wav', wav)
  await page.getByRole('tab', { name: 'Music', exact: true }).click()
  await page.getByRole('button', { name: /Use your own song/ }).click()
  if (!(await page.getByRole('button', { name: 'Choose a song' }).isDisabled())) throw new Error('Choose a song should wait for the rights checkbox')
  await page.getByLabel(/I made this song/).check()
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose a song' }).click()])
  await chooser.setFiles('test-results/my-song.wav')
  await page.waitForSelector('text=your upload', { timeout: 15000 })
  await page.waitForSelector('text=Start the song at')
  ok('own song added after confirming rights, with a start point')
  await page.getByRole('button', { name: 'Export', exact: true }).filter({ visible: true }).first().click()
  await page.getByLabel(/Include the music/).uncheck()
  await page.getByRole('dialog').getByRole('button', { name: 'Export video' }).click()
  await page.waitForSelector('text=/Ready ·/', { timeout: 180000 })
  ok('exported without the music')
} catch (e) {
  console.log('✗', e.message)
  await page.screenshot({ path: 'test-results/lines-fail.png' })
  process.exitCode = 1
}
console.log('errors:', JSON.stringify(unexpected(errors), null, 1))
await browser.close()
