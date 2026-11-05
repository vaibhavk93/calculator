import { describe, expect, it } from 'vitest'
import { D } from './decimal'
import { parseTerm } from './loans/term'
import { toWholeMonths, toYears, typedUnit, unitText, withoutUnit } from './duration'

describe('toYears', () => {
  it('keeps years, turns months into n/12 and days into n/365', () => {
    expect(toYears(new D(5), 'years').toFixed()).toBe('5')
    expect(toYears(new D(18), 'months').toFixed()).toBe('1.5')
    expect(toYears(new D(90), 'days').eq(new D(90).div(365))).toBe(true)
  })
  it('12 months is exactly 1 year, 365 days is exactly 1 year', () => {
    expect(toYears(new D(12), 'months').eq(1)).toBe(true)
    expect(toYears(new D(365), 'days').eq(1)).toBe(true)
  })
})

describe('toWholeMonths', () => {
  it('turns years into months and keeps months', () => {
    expect(toWholeMonths(new D('1.5'), 'years')).toBe(18)
    expect(toWholeMonths(new D(18), 'months')).toBe(18)
    expect(toWholeMonths(new D(15), 'years')).toBe(180)
  })
  it('is null unless it comes to a whole number of at least 1 month', () => {
    expect(toWholeMonths(new D('0.7'), 'years')).toBeNull()
    expect(toWholeMonths(new D('18.5'), 'months')).toBeNull()
    expect(toWholeMonths(new D(0), 'months')).toBeNull()
    expect(toWholeMonths(new D('0.05'), 'years')).toBeNull()
  })
})

describe('typedUnit / withoutUnit / unitText', () => {
  it('reads the unit word the way the loan term parser does', () => {
    for (const w of ['y', 'yr', 'yrs', 'year', 'years', 'm', 'mo', 'mos', 'month', 'months', 'x', 'weeks', 'day']) {
      const text = `18 ${w}`
      const parsed = parseTerm(text)
      const u = typedUnit(text)
      if (u === 'months') expect(parsed).toBe(18)
      else if (u === 'years') expect(parsed).toBe(216)
      else expect(typeof parsed).toBe('object')
    }
  })
  it('is null for a bare number, blank or junk', () => {
    for (const t of ['', '20', ' 1.5 ', 'abc', '18 months 2 days', '-5 years']) expect(typedUnit(t)).toBeNull()
  })
  it('strips the unit word and leaves a bare number alone', () => {
    expect(withoutUnit('18 months')).toBe('18')
    expect(withoutUnit('1.5y')).toBe('1.5')
    expect(withoutUnit('20')).toBe('20')
    expect(withoutUnit('abc')).toBe('abc')
  })
  it('uses the singular for exactly 1', () => {
    expect(unitText(new D(1), 'months')).toBe('month')
    expect(unitText(new D('1.0'), 'years')).toBe('year')
    expect(unitText(new D(18), 'months')).toBe('months')
    expect(unitText(new D('0.5'), 'days')).toBe('days')
  })
})
