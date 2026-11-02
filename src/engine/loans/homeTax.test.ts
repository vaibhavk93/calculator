import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { homeLoanTax } from './homeTax'
import { byYear, schedule } from './loan'

// No official worked example for the 2025 Act was found. These are hand computations from the Act's text
// (s.22(2), s.109(1)(b), s.123, s.202; see rules.ts), using the loan-year split from schedule().
const d = (x: string | number) => new D(x)
const P = d(5000000)
const R = d('8.5')
const y1 = byYear(schedule(P, R, 240))[0]!

describe('homeLoanTax', () => {
  it('old regime, self-occupied: interest capped at 2 lakh, principal at 1.5 lakh', () => {
    const [first] = homeLoanTax(P, R, 240, d(30), 'self', 'old', d(0), d(0))
    expect(y1.interest.gt(200000)).toBe(true)
    expect(first!.interestDeduction.toFixed()).toBe('200000')
    expect(first!.principalDeduction.toFixed(2)).toBe(y1.principal.toFixed(2)) // under 1.5 lakh in year 1
    expect(first!.taxSaved.toFixed(2)).toBe(d(200000).plus(y1.principal).times('0.3').toFixed(2))
  })
  it('principal room shrinks by what other s.123 items already used', () => {
    const [first] = homeLoanTax(P, R, 240, d(30), 'self', 'old', d(0), d(120000))
    expect(first!.principalDeduction.toFixed()).toBe('30000')
  })
  it('old regime, let-out: loss against other income capped at 2 lakh', () => {
    // Rent 2.4 lakh → 30% standard deduction → 1.68 lakh. Year-1 interest ~4.2 lakh, so the loss is capped.
    const [first] = homeLoanTax(P, R, 240, d(30), 'letOut', 'old', d(240000), d(0))
    expect(first!.interestDeduction.toFixed()).toBe('368000')
  })
  it('new regime: nothing for a self-occupied house, let-out interest only down to zero', () => {
    const [self] = homeLoanTax(P, R, 240, d(30), 'self', 'new', d(0), d(0))
    expect(self!.taxSaved.isZero()).toBe(true)
    const [let1] = homeLoanTax(P, R, 240, d(30), 'letOut', 'new', d(240000), d(0))
    expect(let1!.interestDeduction.toFixed()).toBe('168000')
    expect(let1!.principalDeduction.isZero()).toBe(true)
  })
})
