import { describe, expect, it } from 'vitest'
import { caretMap, displayCaret, formatExpression } from './format'

const raw = '150000+2*3'
const shown = formatExpression(raw, 'indian') // "1,50,000 + 2 × 3"

describe('caretMap', () => {
  const map = caretMap(shown, raw)
  it('has one entry per position, ending at the end of the raw text', () => {
    expect(map).toHaveLength(shown.length + 1)
    expect(map[map.length - 1]).toBe(raw.length)
  })
  it('a position after the first comma is after the first digit of the raw text', () => {
    expect(map[shown.indexOf(',') + 1]).toBe(1)
  })
  it('round-trips every raw position', () => {
    for (let i = 0; i <= raw.length; i++) expect(map[displayCaret(map, raw, i)]).toBe(i)
  })
  it('a cursor after an operator sits after its trailing space', () => {
    const afterPlus = displayCaret(map, raw, raw.indexOf('+') + 1)
    expect(shown.slice(0, afterPlus)).toBe('1,50,000 + ')
  })
  it('a cursor before an operator sits before its leading space', () => {
    const beforePlus = displayCaret(map, raw, raw.indexOf('+'))
    expect(shown.slice(0, beforePlus)).toBe('1,50,000')
  })
})
