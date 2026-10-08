/**
 * JSON Schemas for Claude structured outputs. Structured outputs require
 * every object to list all properties as required with additionalProperties
 * false, and don't support numeric/string length constraints (those are
 * enforced by the app's repair step instead).
 */

const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})
const str = { type: 'string' }
const num = { type: 'number' }
const bool = { type: 'boolean' }
const arr = (items: unknown) => ({ type: 'array', items })

export const analyzeClipSchema = obj({
  description: { ...str, description: 'One sentence describing what the clip shows, concrete and visual.' },
  tags: arr(str),
  shotType: { type: 'string', enum: ['talking_head', 'wide', 'closeup', 'pov', 'pan', 'other'] },
  quality: obj({ shaky: bool, blurry: bool, dark: bool, accidental: bool }),
  moments: arr(
    obj({
      start: { ...num, description: 'seconds' },
      end: { ...num, description: 'seconds' },
      score: { ...num, description: '0 to 1' },
      why: str,
      focusX: { ...num, description: 'subject position 0 (left) to 1 (right)' },
      focusY: { ...num, description: 'subject position 0 (top) to 1 (bottom)' },
    }),
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
  ),
})

export const planSchema = obj({
  note: { ...str, description: 'One short sentence describing the edit for the user' },
  scenes: arr(
    obj({
      lineId: { ...str, description: 'The narration line this scene carries; empty string when there is no narration' },
      shots: arr(
        obj({
          clipId: str,
          in: { ...num, description: 'start time inside the clip, seconds' },
          out: { ...num, description: 'end time inside the clip, seconds' },
          focusX: num,
          focusY: num,
          clipAudio: { type: 'string', enum: ['mute', 'duck', 'full'] },
          transitionIn: { type: 'string', enum: ['cut', 'crossfade', 'dip', 'whip'] },
        }),
      ),
    }),
  ),
})
