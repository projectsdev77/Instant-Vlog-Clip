import { describe, expect, it } from 'vitest'
import { toVoiceOption } from './voices'

describe('toVoiceOption', () => {
  it('splits the name and description, and tidies the accent', () => {
    expect(toVoiceOption({ voice_id: 'g7LVvkPWALzPxOQbF6OE', name: 'Jade - Upbeat and Natural', labels: { accent: 'american', gender: 'female' } })).toEqual({
      id: 'g7LVvkPWALzPxOQbF6OE',
      name: 'Jade',
      description: 'Upbeat and Natural',
      gender: 'female',
      accent: 'American',
    })
  })
  it('falls back to the labels when the name has no description', () => {
    const v = toVoiceOption({ voice_id: 'x', name: 'Niamh', labels: { accent: 'south_african', descriptive: 'warm', gender: 'non-binary' } })
    expect(v).toMatchObject({ name: 'Niamh', description: 'Warm', accent: 'South African', gender: 'neutral' })
  })
  it('copes with no labels at all', () => {
    expect(toVoiceOption({ voice_id: 'x', name: 'Sam' })).toMatchObject({ name: 'Sam', description: '', accent: '' })
  })
})
