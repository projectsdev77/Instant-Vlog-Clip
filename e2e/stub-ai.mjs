// A local stand-in for the Supabase Edge Functions (ai and account), so the
// browser tests run without API keys, cost or limits. Its answers are fixed:
// it checks that the app behaves, not how good the AI is.
//   node e2e/stub-ai.mjs   (e2e/run.mjs starts it for you)
// Env: STUB_PORT (54321), APP_URL (where checkout returns to).
import http from 'node:http'
import { readFileSync } from 'node:fs'

const PORT = Number(process.env.STUB_PORT ?? 54321)
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'
// The app warns when the deployed function is older than it; answer with the current version.
const VERSION = readFileSync(new URL('../supabase/functions/_shared/contracts.ts', import.meta.url), 'utf8').match(/AI_FUNCTION_VERSION = '([^']+)'/)?.[1] ?? ''
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-expose-headers': 'x-ai-version',
  'x-ai-version': VERSION,
}
let pro = false

/** A WAV of beeps, about as long as reading the words aloud. */
function speech(words) {
  const sec = Math.max(1, words.length / 2.6)
  const rate = 16000
  const n = Math.round(sec * rate)
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / 8) * 3000 * (Math.floor(i / 2000) % 2)), 44 + i * 2)
  return { audioBase64: buf.toString('base64'), mime: 'audio/wav', words: words.map((w, i) => ({ word: w, start: (i * sec) / words.length, end: ((i + 1) * sec) / words.length })) }
}

function account(action) {
  switch (action) {
    case 'status':
      return {
        email: 'test@example.com',
        plan: pro ? 'pro' : 'free',
        status: pro ? 'trialing' : 'none',
        interval: pro ? 'year' : undefined,
        periodEnd: pro ? new Date(Date.now() + 7 * 864e5).toISOString() : undefined,
        cancelAtPeriodEnd: false,
        trialUsed: pro,
        usage: { generations: 2, revisions: 5 },
        limits: pro ? { generationsPerDay: 30, revisionsPerDay: 300 } : { generationsPerDay: 3, revisionsPerDay: 20 },
        paymentsEnabled: true,
      }
    case 'checkout':
      pro = true
      return { url: `${APP_URL}/account?checkout=success` }
    case 'portal':
      return { url: `${APP_URL}/account` }
    case 'delete':
      pro = false
      return { deleted: true }
  }
}

function ai(action, payload) {
  switch (action) {
    // Clip analysis "fails", so the app's on-device fallback and retry paths run.
    case 'analyze-clip':
      return [502, { code: 'bad_request', error: 'stub' }]
    case 'transcribe':
      return [200, { text: 'so this is my day', words: ['so', 'this', 'is', 'my', 'day'].map((w, i) => ({ word: w, start: 0.3 + i * 0.35, end: 0.6 + i * 0.35 })) }]
    case 'synthesize':
      return [200, speech(payload.text.split(/\s+/).filter(Boolean))]
    // An empty plan makes the app build its own edit from the script.
    case 'plan-edit':
      return [200, { note: 'stub plan', scenes: [] }]
    case 'polish-lines':
      return [200, { lines: payload.lines.map((l) => l.replace('bery good i likedd it', 'Very good, I liked it.').replace('very good weekend i had right there', 'What a great weekend that was.')) }]
    case 'write-script':
      return [
        200,
        {
          title: 'Weekend with friends',
          lines: [
            { text: 'So here is our weekend.', purpose: 'hook', visualIntent: 'coffee', onScreenText: '' },
            { text: 'Coffee first, always.', purpose: 'story', visualIntent: 'coffee', onScreenText: '' },
            { text: 'Best weekend in ages.', purpose: 'outro', visualIntent: 'campfire', onScreenText: '' },
          ],
        },
      ]
    default:
      return [500, { error: `stub: unknown action ${action}` }]
  }
}

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(200, cors)
      return res.end('ok')
    }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let parsed = {}
      try {
        parsed = JSON.parse(body)
      } catch {
        // not JSON
      }
      const send = (code, o) => {
        res.writeHead(code, { ...cors, 'content-type': 'application/json' })
        res.end(JSON.stringify(o))
      }
      if (req.url.includes('/functions/v1/account')) {
        const out = account(parsed.action)
        return out ? send(200, out) : send(400, { error: 'Unknown action' })
      }
      const [code, out] = ai(parsed.action, parsed.payload ?? {})
      send(code, out)
    })
  })
  .listen(PORT, () => console.log(`stand-in AI on http://localhost:${PORT}`))
