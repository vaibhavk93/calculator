import { describe, expect, it } from 'vitest'
import type { Field } from '../../lib/tool'
import { addAmount, advancedOpen, chipSteps, caretFor, groupTyped, migrateLegacyTerm, rawNumber, shouldGroup, significantBefore } from './fieldInput'
import { ALL_TOOLS } from './registry'
import { isError } from '../../lib/tool'

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

describe('cards saved with the old years/months pair', () => {
  const emi = ALL_TOOLS.find((t) => t.id === 'emi')!
  const compare = ALL_TOOLS.find((t) => t.id === 'loan-compare')!
  const old = { principal: '5000000', rate: '8.5', tenure: '18', tenureUnit: 'months' }

  it('become one term text, and the old key is gone', () => {
    const v = migrateLegacyTerm(emi.fields, old)
    expect(v.tenure).toBe('18 months')
    expect('tenureUnit' in v).toBe(false)
    expect(v.principal).toBe('5000000')
  })
  it('years stay a bare number (bare means years)', () => {
    expect(migrateLegacyTerm(emi.fields, { ...old, tenure: '20', tenureUnit: 'years' }).tenure).toBe('20')
  })
  it('give the same answer before and after migrating', () => {
    const before = emi.compute(old)
    const after = emi.compute(migrateLegacyTerm(emi.fields, old))
    expect(isError(after)).toBe(false)
    expect(JSON.stringify(after)).toBe(JSON.stringify(before))
    const years = { ...old, tenure: '20', tenureUnit: 'years' }
    expect(JSON.stringify(emi.compute(migrateLegacyTerm(emi.fields, years)))).toBe(JSON.stringify(emi.compute({ ...years, tenure: '20 years', tenureUnit: 'years' })))
  })
  it('already-new values pass through untouched', () => {
    const v = { principal: '1', rate: '2', tenure: '18 months' }
    expect(migrateLegacyTerm(emi.fields, v)).toBe(v)
  })
  it('loan compare: the one switch applies to every offer, as it did before', () => {
    const v = migrateLegacyTerm(compare.fields, { offers: [['5000000', '8.5', '20', '10000'], ['5000000', '8.35', '20', '25000']], tenureUnit: 'months' })
    expect(v.offers).toEqual([['5000000', '8.5', '20 months', '10000'], ['5000000', '8.35', '20 months', '25000']])
    expect('tenureUnit' in v).toBe(false)
  })
})

describe('quick-add chips', () => {
  it('adds to what is typed, blank counts as zero, decimals stay exact', () => {
    expect(addAmount('', '1000')).toBe('1000')
    expect(addAmount('250000', '100000')).toBe('350000')
    expect(addAmount('0.1', '1000')).toBe('1000.1')
    expect(addAmount('-500', '1000')).toBe('500')
  })
  it('never wipes text it cannot read', () => {
    expect(addAmount('12abc', '1000')).toBeNull()
    expect(addAmount('-', '1000')).toBeNull()
  })
  it('labels the lakh step the Indian way and the same amount in thousands elsewhere', () => {
    expect(chipSteps('indian').map((c) => c.label)).toEqual(['+1K', '+10K', '+1L'])
    expect(chipSteps('international').map((c) => c.label)).toEqual(['+1K', '+10K', '+100K'])
    expect(chipSteps('indian').map((c) => c.step)).toEqual(chipSteps('international').map((c) => c.step))
  })
})
