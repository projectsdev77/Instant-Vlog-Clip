// A local stand-in for Supabase (the ai and account functions, sign-in, and the
// vlogs table and file storage used to save vlogs to the account), so the
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
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

// Ask AI: a few fixed answers by keyword, like the real editor would give.
function editAnswer({ request, vlog }) {
  const r = request.toLowerCase()
  const op = (o) => ({ scene: '', shot: 0, to: 0, value: '', amount: 0, ...o })
  const last = vlog.scenes[vlog.scenes.length - 1].ref
  const broll = vlog.scenes.find((s) => !s.line)?.ref ?? vlog.scenes[1]?.ref ?? 's1'
  if (r.includes('sticker')) return { reply: 'I can’t add stickers. I can change the look, the music, the captions or the footage.', ops: [] }
  if (r.includes('black and white')) return { reply: 'Switched the whole vlog to black and white.', ops: [op({ op: 'filter', value: 'mono' })] }
  if (r.includes('punchier')) return { reply: 'Sped up a footage scene and added a whip between scenes.', ops: [op({ op: 'speed', scene: broll, value: '2' }), op({ op: 'transition', scene: vlog.scenes[1]?.ref ?? 's1', value: 'whip' }), op({ op: 'music', value: 'city-pop' })] }
  if (r.includes('slow')) return { reply: 'Slowed that part down.', ops: [op({ op: 'speed', scene: broll, value: '0.5' })] }
  if (r.includes('shorter') || r.includes('20')) return { reply: 'Made it about 20 seconds.', ops: [op({ op: 'length', amount: 20 })] }
  if (r.includes('funnier') || r.includes('intro')) return { reply: 'Rewrote the intro to be funnier.', ops: [op({ op: 'rewrite-line', scene: 's1', value: 'Okay, this weekend got a little out of hand.' })] }
  if (r.startsWith('open with')) return { reply: 'Moved that shot to the start.', ops: [op({ op: 'move-scene', scene: last, to: 1 })] }
  if (r.includes('mute the first')) return { reply: 'Muted the first scene.', ops: [op({ op: 'clip-sound', scene: 's1', value: 'mute' })] }
  return { reply: 'Which scene do you mean?', ops: [] }
}

// Sign-in: sign-up always "sends a confirmation email"; taken@example.com already has an account;
// logging in works with the password "correct-horse-9"; reset and resend emails always "go out".
function session(email) {
  const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, identities: [{ id: '1' }], created_at: new Date().toISOString() }
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', email })}.sig`
  return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'test-refresh', user }
}

function auth(url, body) {
  const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: body.email ?? 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  if (url.includes('/signup')) return [200, { ...user, identities: body.email === 'taken@example.com' ? [] : [{ id: '1' }] }]
  if (url.includes('/token')) {
    if (body.password === 'correct-horse-9') return [200, session(body.email)]
    return [400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }]
  }
  if (url.includes('/recover') || url.includes('/resend') || url.includes('/otp')) return [200, {}]
  if (url.includes('/user')) return [200, user]
  if (url.includes('/logout')) return [204, {}]
  return [404, { msg: 'stub: unknown auth call' }]
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
    case 'edit-request':
      return [200, editAnswer(payload)]
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
    // STUB_VOICES=1: the account has voices of its own, as after adding some from the Voice Library.
    case 'list-voices':
      return process.env.STUB_VOICES === '1'
        ? [200, { source: 'account', voices: [{ id: 'g7LVvkPWALzPxOQbF6OE', name: 'Jade', description: 'Upbeat and Natural', gender: 'female', accent: 'American' }, { id: 'BHr135B5EUBtaWheVj8S', name: 'Dan', description: 'Warm and engaging', gender: 'male', accent: 'British' }] }]
        : [200, { voices: [], source: 'builtin' }]
    default:
      return [500, { error: `stub: unknown action ${action}` }]
  }
}

// Account storage: the vlogs table and the vlogs bucket, in memory, for one signed-in user.
const vlogs = new Map()
const files = new Map()
const SPACE_LIMIT = Number(process.env.STUB_SPACE_LIMIT ?? 50_000_000)
const filter = (url, key) => new URL(url, 'http://x').searchParams.get(key)?.replace(/^eq\./, '')

function rest(req, body) {
  const url = req.url
  if (url.includes('/rest/v1/rpc/my_storage')) return [200, { used: [...files.values()].reduce((a, b) => a + b.length, 0), limit: SPACE_LIMIT, plan: 'free' }]
  if (!url.includes('/rest/v1/vlogs')) return [404, { message: 'stub: unknown table' }]
  const id = filter(url, 'id')
  if (req.method === 'GET') {
    const rows = [...vlogs.values()].filter((r) => !id || r.id === id).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    const cols = new URL(url, 'http://x').searchParams.get('select')
    return [200, cols === '*' || !cols ? rows : rows.map((r) => Object.fromEntries(cols.split(',').map((c) => c.trim()).map((c) => [c, r[c] ?? null])))]
  }
  if (req.method === 'POST') {
    for (const row of [body].flat()) vlogs.set(row.id, { video_bytes: null, video_at: null, ...vlogs.get(row.id), ...row })
    return [201, null]
  }
  if (req.method === 'PATCH') {
    if (vlogs.has(id)) vlogs.set(id, { ...vlogs.get(id), ...body })
    return [204, null]
  }
  if (req.method === 'DELETE') {
    vlogs.delete(id)
    return [204, null]
  }
  return [405, null]
}

function storage(req, raw) {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/^\/storage\/v1\//, ''))
  if (path.startsWith('object/list/vlogs')) {
    const { prefix = '' } = JSON.parse(raw.toString() || '{}')
    const dir = prefix.replace(/\/$/, '')
    const names = new Map()
    for (const k of files.keys()) {
      if (!k.startsWith(`${dir}/`)) continue
      const [first, ...rest] = k.slice(dir.length + 1).split('/')
      names.set(first, rest.length ? null : 'file')
    }
    return [200, [...names].map(([name, kind]) => ({ name, id: kind ? name : null, metadata: kind ? { size: files.get(`${dir}/${name}`).length } : null }))]
  }
  if (path.startsWith('object/sign/vlogs/')) return [200, { signedURL: `/object/public/${path.slice('object/sign/'.length)}?token=stub` }]
  if (req.method === 'DELETE' && path === 'object/vlogs') {
    for (const p of JSON.parse(raw.toString()).prefixes ?? []) files.delete(p)
    return [200, []]
  }
  const key = path.replace(/^object\/(authenticated\/|public\/)?vlogs\//, '')
  if (req.method === 'POST' || req.method === 'PUT') {
    files.set(key, raw)
    return [200, { Key: `vlogs/${key}` }]
  }
  if (req.method === 'GET') return files.has(key) ? [200, files.get(key), 'application/octet-stream'] : [400, { statusCode: '404', error: 'not_found', message: 'Object not found' }]
  return [405, null]
}

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(200, cors)
      return res.end('ok')
    }
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks)
      let parsed = {}
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        // not JSON
      }
      const send = (code, o, type) => {
        if (o === null) {
          res.writeHead(code, cors)
          return res.end()
        }
        res.writeHead(code, { ...cors, 'content-type': type ?? 'application/json' })
        res.end(Buffer.isBuffer(o) ? o : JSON.stringify(o))
      }
      // For the tests: what the account holds now.
      if (req.url.startsWith('/__stub/account')) return send(200, { vlogs: [...vlogs.values()].map(({ data: _d, ...r }) => r), files: [...files.keys()] })
      if (req.url.includes('/rest/v1/')) return send(...rest(req, parsed))
      if (req.url.includes('/storage/v1/')) return send(...storage(req, raw))
      if (req.url.includes('/auth/v1/')) {
        const [code, out] = auth(req.url, parsed)
        return send(code, out)
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
