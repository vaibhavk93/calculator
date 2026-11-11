import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { breakEven, profitAt } from './breakEven'

const d = (x: string | number) => new D(x)
const be = (fixed: string, price: string, variable: string, planned: string | null = null) => breakEven(d(fixed), d(price), d(variable), planned === null ? null : d(planned))!

describe('break-even', () => {
  // Hand-worked: fixed 5,00,000, price 1,000, variable 600: each unit adds 400, so 5,00,000 / 400 = 1,250 units,
  // and 1,250 x 1,000 = 12,50,000 of sales.
  it('hand-worked: 5,00,000 fixed, price 1,000, variable 600 breaks even at 1,250 units and 12,50,000 sales', () => {
    const r = be('500000', '1000', '600')
    expect(r.contribution.toFixed()).toBe('400')
    expect(r.contributionPct.toFixed()).toBe('40')
    expect(r.exactUnits.toFixed()).toBe('1250')
    expect(r.units.toFixed()).toBe('1250')
    expect(r.revenue.toFixed()).toBe('1250000')
    expect(r.planned).toBeNull()
  })
  // Hand-worked with a part unit: 1,00,000 / (50 - 20) = 3,333.33, so 3,334 whole units and 3,334 x 50 = 1,66,700 of sales.
  // Cross-check by the contribution-margin-ratio formula: sales = fixed / (30 / 50) = 1,00,000 / 0.6 = 1,66,666.67 (exact, no rounding up).
  it('rounds units up: 1,00,000 fixed, price 50, variable 20 needs 3,334 units and 1,66,700 sales', () => {
    const r = be('100000', '50', '20')
    expect(r.exactUnits.toFixed(2)).toBe('3333.33')
    expect(r.units.toFixed()).toBe('3334')
    expect(r.revenue.toFixed()).toBe('166700')
    expect(d(100000).div(r.contributionPct.div(100)).toFixed(2)).toBe('166666.67')
  })
  it('property: the rounded-up units cover the fixed costs and one unit fewer does not', () => {
    for (const [f, p, v] of [['500000', '1000', '600'], ['100000', '50', '20'], ['12345.67', '9.99', '3.5'], ['1', '0.03', '0.01'], ['750000', '2499', '1800.5']] as const) {
      const r = be(f, p, v)
      expect(profitAt(d(f), d(p), d(v), r.units).gte(0), `${f} ${p} ${v}`).toBe(true)
      expect(profitAt(d(f), d(p), d(v), r.units.minus(1)).lt(0), `${f} ${p} ${v}`).toBe(true)
    }
  })
  // Hand-worked: planned 2,000 units. Margin of safety = (2,000 - 1,250) / 2,000 = 37.5%, 750 units.
  // Cross-check by the standard identity: profit = margin-of-safety units x contribution per unit = 750 x 400 = 3,00,000,
  // and directly 2,000 x 400 - 5,00,000 = 3,00,000.
  it('hand-worked margin of safety: 2,000 planned against 1,250 is 750 units, 37.5%, profit 3,00,000', () => {
    const r = be('500000', '1000', '600', '2000')
    expect(r.planned!.safetyUnits.toFixed()).toBe('750')
    expect(r.planned!.safetyPct.toFixed()).toBe('37.5')
    expect(r.planned!.profit.toFixed()).toBe('300000')
    expect(r.planned!.safetyUnits.times(r.contribution).eq(r.planned!.profit)).toBe(true)
  })
  it('a planned volume below break-even gives a negative margin and a loss: 1,000 planned = 250 short, loss 1,00,000', () => {
    const r = be('500000', '1000', '600', '1000')
    expect(r.planned!.safetyUnits.toFixed()).toBe('-250')
    expect(r.planned!.safetyPct.toFixed()).toBe('-25')
    expect(r.planned!.profit.toFixed()).toBe('-100000')
  })
  it('planned exactly at break-even has a zero margin and zero profit', () => {
    const r = be('500000', '1000', '600', '1250')
    expect(r.planned!.safetyPct.isZero()).toBe(true)
    expect(r.planned!.profit.isZero()).toBe(true)
  })
  it('a zero variable cost is allowed (a pure service): 10,000 fixed, price 500 breaks even at 20 units', () => {
    expect(be('10000', '500', '0').units.toFixed()).toBe('20')
  })
  it('returns null, never NaN, when there is no break-even', () => {
    const none = (f: string, p: string, v: string, q: string | null = null) => breakEven(d(f), d(p), d(v), q === null ? null : d(q))
    expect(none('500000', '600', '600')).toBeNull() // price equals variable cost
    expect(none('500000', '500', '600')).toBeNull() // each unit loses money
    expect(none('0', '1000', '600')).toBeNull()
    expect(none('-1', '1000', '600')).toBeNull()
    expect(none('500000', '0', '0')).toBeNull()
    expect(none('500000', '1000', '-5')).toBeNull()
    expect(none('500000', '1000', '600', '0')).toBeNull()
    expect(none('500000', '1000', '600', '-3')).toBeNull()
  })
})
