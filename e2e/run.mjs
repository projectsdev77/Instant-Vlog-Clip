// Runs the browser tests end to end: starts the stand-in AI (e2e/stub-ai.mjs)
// and a dev server pointed at it, runs each suite in Chromium, then prints a
// summary. Needs no API keys and doesn't touch your Supabase project.
//   npm run e2e                 every suite
//   npm run e2e -- flow lines   only these
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const APP_PORT = 5179 // not 5173, so it doesn't clash with your own `npm run dev`
const STUB_PORT = 54329
const APP_URL = `http://localhost:${APP_PORT}`
const SUITE_TIMEOUT_MS = 15 * 60_000

const SUITES = [
  { name: 'flow', file: 'e2e/flow.mjs', what: 'Core journey: clips, script, AI voice, Make, Edit, Ask AI, undo, export' },
  { name: 'variants', file: 'e2e/variants.mjs', what: 'Own voice, Record page, say my own thing, montage, cancel Make, reload, backup and restore' },
  { name: 'lines', file: 'e2e/lines.mjs', what: 'Line tools, keep-your-changes question, title off, own music, export without music' },
  { name: 'tutorial', file: 'e2e/tutorial.mjs', what: 'First-visit tutorial on a phone' },
  { name: 'tutorial-desktop', file: 'e2e/tutorial.mjs', env: { DESKTOP: '1' }, what: 'First-visit tutorial on a computer' },
  { name: 'edit', file: 'e2e/edit.mjs', what: 'Edit page: strip, scene tools, More options, versions, length, sliders, captions, previews' },
  { name: 'effects', file: 'e2e/effects.mjs', what: 'Templates, shot tools (split, freeze, speed, camera) and export' },
  { name: 'account', file: 'e2e/account.mjs', what: 'Plans, Account, checkout return, delete account, legal pages' },
]

const only = process.argv.slice(2)
const unknown = only.filter((n) => !SUITES.some((s) => s.name === n))
if (unknown.length) {
  console.error(`Unknown suite: ${unknown.join(', ')}. Choose from: ${SUITES.map((s) => s.name).join(', ')}`)
  process.exit(2)
}
const suites = only.length ? SUITES.filter((s) => only.includes(s.name)) : SUITES

if (!existsSync(chromium.executablePath())) {
  console.error('Playwright’s Chromium isn’t installed. Run this once, then try again:\n  npx playwright install chromium')
  process.exit(2)
}
mkdirSync('test-results', { recursive: true })

const children = []
const start = (args, env) => {
  const child = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)
  return child
}
const stopAll = () => children.forEach((c) => c.exitCode === null && c.kill())
process.on('exit', stopAll)
process.on('SIGINT', () => process.exit(130))

/** Resolves once `url` answers, or fails after `ms`. */
async function waitFor(url, ms, child, label) {
  const until = Date.now() + ms
  let log = ''
  child.stdout.on('data', (d) => (log += d))
  child.stderr.on('data', (d) => (log += d))
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`${label} stopped:\n${log}`)
    try {
      const res = await fetch(url, { method: 'OPTIONS' })
      if (res.status < 500) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`${label} didn’t start within ${ms / 1000} s:\n${log}`)
}

const stub = start(['e2e/stub-ai.mjs'], { STUB_PORT: String(STUB_PORT), APP_URL })
await waitFor(`http://localhost:${STUB_PORT}/`, 10_000, stub, 'The stand-in AI')
// Real env vars win over .env.local, so your own Supabase settings are left alone.
const vite = start(['node_modules/vite/bin/vite.js', '--port', String(APP_PORT), '--strictPort'], {
  VITE_SUPABASE_URL: `http://localhost:${STUB_PORT}`,
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  VITE_AUTH_GOOGLE: 'true',
})
await waitFor(APP_URL, 60_000, vite, `The dev server (port ${APP_PORT})`)
// The first page load makes Vite bundle dependencies; do it before the first suite.
await fetch(APP_URL).then((r) => r.text())
console.log(`App on ${APP_URL}, stand-in AI on port ${STUB_PORT}.\n`)

function runSuite(suite) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    console.log(`\n━━ ${suite.name}: ${suite.what}`)
    const child = spawn(process.execPath, [suite.file], { env: { ...process.env, BASE_URL: APP_URL, ...suite.env }, stdio: 'inherit' })
    const timer = setTimeout(() => child.kill(), SUITE_TIMEOUT_MS)
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ ...suite, ok: code === 0, why: signal ? 'timed out' : code ? `exit code ${code}` : '', secs: Math.round((Date.now() - t0) / 1000) })
    })
  })
}

const results = []
for (const s of suites) results.push(await runSuite(s))

console.log('\n━━ Summary')
for (const r of results) console.log(`${r.ok ? '✓ PASS' : '✗ FAIL'}  ${r.name.padEnd(17)} ${String(r.secs).padStart(4)} s  ${r.ok ? r.what : r.why}`)
const failed = results.filter((r) => !r.ok)
console.log(failed.length ? `\n${failed.length} of ${results.length} suites failed. Scroll up to the ✗ line in each for the reason; screenshots are in test-results/.` : `\nAll ${results.length} suites passed.`)
stopAll()
process.exit(failed.length ? 1 : 0)
