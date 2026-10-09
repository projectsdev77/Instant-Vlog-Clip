/**
 * JSON Schemas for the AI's structured answers. They include numeric and
 * array limits; each provider gets a version it supports:
 * - forClaude(): strips limits (Claude structured outputs reject them; the
 *   app's repair step enforces them instead)
 * - forGemini(): keeps limits and adds `propertyOrdering`, so Gemini writes
 *   fields in a sensible order (e.g. start before end)
 * Every object lists all properties as required with additionalProperties false.
 */

type Schema = Record<string, unknown>

const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})
const str = { type: 'string' }
const unit = (description: string) => ({ type: 'number', minimum: 0, maximum: 1, description })
const secs = (description: string) => ({ type: 'number', minimum: 0, description })
const bool = { type: 'boolean' }
const arr = (items: unknown, minItems?: number, maxItems?: number) => ({ type: 'array', items, ...(minItems !== undefined && { minItems }), ...(maxItems !== undefined && { maxItems }) })

export const analyzeClipSchema = obj({
  description: { ...str, description: 'One sentence describing what the clip shows, concrete and visual.' },
  tags: arr(str, 1, 8),
  shotType: { type: 'string', enum: ['talking_head', 'wide', 'closeup', 'pov', 'pan', 'other'] },
  quality: obj({ shaky: bool, blurry: bool, dark: bool, accidental: bool }),
  moments: arr(
    obj({
      start: secs('seconds from the start of the clip'),
      end: secs('seconds from the start of the clip, after start'),
      score: unit('how good this moment is for a vlog, 0 to 1'),
      why: str,
      focusX: unit('subject position 0 (left) to 1 (right)'),
      focusY: unit('subject position 0 (top) to 1 (bottom)'),
    }),
    1,
    5,
  ),
})

export const scriptSchema = obj({
  title: { ...str, description: 'Short title shown big on screen, 2-5 words' },
  lines: arr(
    obj({
      text: { ...str, description: 'One spoken sentence of first-person narration' },
      purpose: { type: 'string', enum: ['hook', 'story', 'outro'] },
      visualIntent: { ...str, description: 'What the footage for this line should show' },
      onScreenText: { ...str, description: 'Optional extra text overlay; empty string for none' },
    }),
    1,
    14,
  ),
})

export const planSchema = obj({
  note: { ...str, description: 'One short sentence describing the edit for the user' },
  scenes: arr(
    obj({
      lineId: { ...str, description: 'The narration line this scene carries; empty string when there is no narration' },
      shots: arr(
        obj({
          clipId: { ...str, description: 'Exactly one of the clipIds from the catalog' },
          in: secs('start time inside the clip, seconds'),
          out: secs('end time inside the clip, seconds, after in'),
          focusX: unit('subject position 0 (left) to 1 (right)'),
          focusY: unit('subject position 0 (top) to 1 (bottom)'),
          clipAudio: { type: 'string', enum: ['mute', 'duck', 'full'] },
          transitionIn: { type: 'string', enum: ['cut', 'crossfade', 'dip', 'whip'] },
        }),
        1,
        3,
      ),
    }),
    1,
  ),
})

const LIMIT_KEYS = ['minimum', 'maximum', 'minItems', 'maxItems', 'propertyOrdering']

function walk(schema: unknown, fn: (s: Schema) => Schema): unknown {
  if (Array.isArray(schema)) return schema.map((x) => walk(x, fn))
  if (!schema || typeof schema !== 'object') return schema
  const out: Schema = {}
  for (const [k, v] of Object.entries(schema as Schema)) out[k] = k === 'enum' || k === 'required' ? v : walk(v, fn)
  return fn(out)
}

export function forClaude(schema: Schema): Schema {
  return walk(schema, (s) => {
    for (const k of LIMIT_KEYS) delete s[k]
    return s
  }) as Schema
}

export function forGemini(schema: Schema): Schema {
  return walk(schema, (s) => {
    if (s.type === 'object' && s.properties && typeof s.properties === 'object') {
      s.propertyOrdering = Object.keys(s.properties as Schema)
    }
    return s
  }) as Schema
}
