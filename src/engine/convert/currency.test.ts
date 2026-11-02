import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { convertCurrency } from './currency'
import { CURRENCY_SNAPSHOT } from './currencySnapshot'

// Not checked against a second published source: the snapshot IS the published source (Frankfurter, 2026-10-30).
// These tests recompute cross rates by hand from the figures in that snapshot.
const table = { INR: '1', USD: '0.0125', EUR: '0.01' }

describe('convertCurrency', () => {
  it('INR to a currency multiplies by its rate', () => {
    expect(convertCurrency(new D(8000), 'INR', 'USD', table)!.result.toFixed()).toBe('100')
  })
  it('a currency to INR divides, and the rate is INR per unit', () => {
    const r = convertCurrency(new D(100), 'USD', 'INR', table)!
    expect(r.result.toFixed()).toBe('8000')
    expect(r.rate.toFixed()).toBe('80')
  })
  it('cross rate goes through INR', () => {
    expect(convertCurrency(new D(100), 'USD', 'EUR', table)!.result.toFixed()).toBe('80')
  })
  it('same currency is 1:1; unknown currency is null', () => {
    expect(convertCurrency(new D(5), 'USD', 'USD', table)!.result.toFixed()).toBe('5')
    expect(convertCurrency(new D(5), 'USD', 'XYZ', table)).toBeNull()
  })
  it('the bundled snapshot is dated and has INR as 1', () => {
    expect(CURRENCY_SNAPSHOT.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(CURRENCY_SNAPSHOT.perInr.INR).toBe('1')
    expect(Object.keys(CURRENCY_SNAPSHOT.perInr).length).toBeGreaterThanOrEqual(30)
  })
})
