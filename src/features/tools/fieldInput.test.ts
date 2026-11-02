import { describe, expect, it } from 'vitest'
import type { Field } from '../../lib/tool'
import { advancedOpen, caretFor, groupTyped, rawNumber, shouldGroup, significantBefore } from './fieldInput'

describe('typing with grouping', () => {
  it('keeps only digits, one dot and a leading minus', () => {
    expect(rawNumber('₹ 50,00,000')).toBe('5000000')
    expect(rawNumber('1.2.3')).toBe('1.23')
    expect(rawNumber('−12')).toBe('-12')
    expect(rawNumber('5-3')).toBe('53')
    expect(rawNumber('')).toBe('')
  })
  it('groups the whole part in either system', () => {
    expect(groupTyped('5000000', 'indian')).toBe('50,00,000')
    expect(groupTyped('5000000', 'international')).toBe('5,000,000')
    expect(groupTyped('-1234567.5', 'indian')).toBe('-12,34,567.5')
    expect(groupTyped('12.', 'indian')).toBe('12.')
    expect(groupTyped('', 'indian')).toBe('')
    expect(groupTyped('.5', 'indian')).toBe('.5')
  })
  it('keeps the caret after the same digit when commas move', () => {
    // typed a 4th digit at the end of "123": display "1,234", caret after 4 significant chars
    expect(significantBefore('1234', 4)).toBe(4)
    expect(caretFor('1,234', 4)).toBe(5)
    // typed in the middle: "12|3" -> "12x3" i.e. 4 digits, caret after the 3rd
    expect(caretFor(groupTyped('1273', 'international'), 3)).toBe(4)
    expect(caretFor('1,234', 0)).toBe(0)
    expect(caretFor('1,234', 99)).toBe(5)
    expect(significantBefore('1,2', 3)).toBe(2)
  })
  it('groups only rupee and unitless number fields', () => {
    const n = (unit?: 'rupee' | 'percent' | 'years') => ({ id: 'a', label: 'A', kind: 'number', unit }) as const
    expect(shouldGroup(n('rupee'))).toBe(true)
    expect(shouldGroup(n())).toBe(true)
    expect(shouldGroup(n('percent'))).toBe(false)
    expect(shouldGroup(n('years'))).toBe(false)
    expect(shouldGroup({ id: 'd', label: 'D', kind: 'text' })).toBe(false)
  })
})

describe('advancedOpen', () => {
  const fields: Field[] = [
    { id: 'a', label: 'A', kind: 'number', default: '1' },
    { id: 'b', label: 'B', kind: 'number', default: '2', advanced: true },
    { id: 'c', label: 'C', kind: 'number', advanced: true, visibleIf: (v) => v.a === '9' },
  ]
  it('stays closed while advanced fields hold their defaults', () => {
    expect(advancedOpen(fields, { a: '1', b: '2', c: '' })).toBe(false)
  })
  it('opens when an advanced field was changed', () => {
    expect(advancedOpen(fields, { a: '1', b: '3', c: '' })).toBe(true)
  })
  it('ignores a changed field that is not shown', () => {
    expect(advancedOpen(fields, { a: '1', b: '2', c: '5' })).toBe(false)
    expect(advancedOpen(fields, { a: '9', b: '2', c: '5' })).toBe(true)
  })
})
