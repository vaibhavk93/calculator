import { describe, expect, it } from 'vitest'
import { legacyTermText, parseTerm, termChip } from './term'

describe('parseTerm', () => {
  it.each([
    ['18 months', 18],
    ['18 month', 18],
    ['18m', 18],
    ['18 mo', 18],
    ['20 years', 240],
    ['20y', 240],
    ['20 yrs', 240],
    ['1.5 years', 18],
    ['1.5y', 18],
    ['20', 240], // a bare number is years
    [' 20 Years ', 240],
    ['.5y', 6],
    ['50 years', 600],
  ])('%s -> %i months', (text, months) => expect(parseTerm(text)).toBe(months))

  it.each([
    ['', 'Enter loan term'],
    ['0', 'Loan term must be more than zero'],
    ['0 months', 'Loan term must be more than zero'],
    ['0.7 years', 'Loan term must come to a whole number of months'],
    ['18.5 months', 'Loan term must come to a whole number of months'],
    ['51 years', 'Loan term can be at most 50 years'],
    ['601 months', 'Loan term can be at most 50 years'],
  ])('%j is refused in plain words', (text, error) => expect(parseTerm(text)).toEqual({ error }))

  it('refuses junk and unknown units without NaN', () => {
    for (const t of ['abc', '12abc', '5 weeks', '-3 years', '1e3', '2..5']) {
      const r = parseTerm(t)
      expect(typeof r === 'object' ? r.error : '').toMatch(/^Loan term/)
    }
  })
})

describe('termChip', () => {
  it('shows "years" only while the unit is an assumption', () => {
    expect(termChip('20')).toBe('years')
    expect(termChip('')).toBe('years')
    expect(termChip('1.5')).toBe('years')
    expect(termChip('20 years')).toBe('')
    expect(termChip('18m')).toBe('')
  })
})

describe('legacyTermText (cards saved with the years/months pair)', () => {
  it('turns a months pair into one text', () => expect(legacyTermText('18', 'months')).toBe('18 months'))
  it('leaves years and missing units as they were (bare means years)', () => {
    expect(legacyTermText('20', 'years')).toBe('20')
    expect(legacyTermText('20', undefined)).toBe('20')
  })
  it('does not touch text that already carries a unit', () => expect(legacyTermText('18 months', 'months')).toBe('18 months'))
})
