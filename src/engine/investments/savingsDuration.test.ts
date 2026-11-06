import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { effectiveYield, goalSip, goalSipMonths, lumpsum, lumpsumAt, lumpsumRows, sip, sipFutureValue, sipMonths } from './invest'

const close = (a: { toNumber(): number }, b: number, rel = 1e-9) => expect(Math.abs(a.toNumber() - b) / Math.abs(b)).toBeLessThan(rel)

/** Plain float loop, written independently of the engine: month by month, payment at the start of the month. */
function floatSip(monthly: number, ratePct: number, months: number, stepPct = 0) {
  let amt = monthly
  let bal = 0
  for (let m = 1; m <= months; m++) {
    bal = (bal + amt) * (1 + ratePct / 1200)
    if (m % 12 === 0) amt *= 1 + stepPct / 100
  }
  return bal
}

describe('sipMonths', () => {
  it('120 months equals the whole-years SIP (about 11,61,695 for 5000 at 12% over 10 years)', () => {
    const a = sipMonths(new D(5000), new D(12), 120)
    const b = sip(new D(5000), new D(12), 10)
    expect(a).toHaveLength(10)
    expect(a.map((r) => [r.months / 12, r.invested.toString(), r.value.toString()])).toEqual(b.map((r) => [r.year, r.invested.toString(), r.value.toString()]))
    expect(a.at(-1)!.value.toDecimalPlaces(0).toString()).toBe('1161695')
  })
  it('18 months: a row at month 12, a last row at month 18, equal to a plain loop and the closed form', () => {
    const rows = sipMonths(new D(5000), new D(12), 18)
    expect(rows.map((r) => r.months)).toEqual([12, 18])
    expect(rows[1]!.invested.toString()).toBe('90000')
    close(rows[1]!.value, floatSip(5000, 12, 18))
    expect(rows[1]!.value.toString()).toBe(sipFutureValue(new D(5000), new D(12), 18).toString())
    expect(rows[1]!.value.toDecimalPlaces(2).toString()).toBe('99054.48')
  })
  it('a short plan has only the final row; zero months has none', () => {
    expect(sipMonths(new D(1000), new D(12), 5).map((r) => r.months)).toEqual([5])
    expect(sipMonths(new D(1000), new D(12), 0)).toEqual([])
  })
  it('step-up starts at month 13, not before', () => {
    const at12 = sipMonths(new D(5000), new D(12), 12, new D(10)).at(-1)!
    expect(at12.value.toString()).toBe(sipMonths(new D(5000), new D(12), 12).at(-1)!.value.toString())
    const at13 = sipMonths(new D(5000), new D(12), 13, new D(10)).at(-1)!
    expect(at13.invested.toString()).toBe('65500')
    close(at13.value, (floatSip(5000, 12, 12) + 5500) * 1.01)
    close(sipMonths(new D(5000), new D(12), 30, new D(10)).at(-1)!.value, floatSip(5000, 12, 30, 10))
  })
})

describe('goalSipMonths', () => {
  it('whole years are identical to goalSip, with and without savings', () => {
    for (const [t, r, y, e] of [[1000000, 12, 10, 0], [5000000, 10, 15, 200000], [800000, 8, 3, 50000]] as const) {
      expect(goalSipMonths(new D(t), new D(r), y * 12, new D(e))!.toString()).toBe(goalSip(new D(t), new D(r), y, new D(e))!.toString())
    }
  })
  it('18 months: the SIP it asks for really reaches the target (savings grow (1+r)^1.5)', () => {
    const p = goalSipMonths(new D(500000), new D(12), 18, new D(100000))!
    const got = floatSip(p.toNumber(), 12, 18) + 100000 * 1.12 ** 1.5
    close(new D(got), 500000, 1e-9)
  })
  it('0 when savings alone reach it, null with no months', () => {
    expect(goalSipMonths(new D(100000), new D(10), 120, new D(50000))!.toString()).toBe('0')
    expect(goalSipMonths(new D(1), new D(10), 0, new D(0))).toBeNull()
  })
})

describe('lumpsumAt / lumpsumRows', () => {
  it('whole years equal lumpsum()', () => {
    const a = lumpsumRows(new D(100000), new D(12), new D(10))
    const b = lumpsum(new D(100000), new D(12), 10)
    expect(a.map((r) => [r.years.toString(), r.value.toString()])).toEqual(b.map((r) => [String(r.year), r.value.toString()]))
  })
  it('18 months is 1.5 years: a whole-year row and a last row', () => {
    const rows = lumpsumRows(new D(100000), new D(12), new D(18).div(12))
    expect(rows.map((r) => r.years.toString())).toEqual(['1', '1.5'])
    close(rows[1]!.value, 100000 * 1.12 ** 1.5)
  })
  it('90 days is 90/365 of a year', () => {
    const t = new D(90).div(365)
    close(lumpsumAt(new D(100000), new D(12), t), 100000 * 1.12 ** (90 / 365))
    expect(lumpsumRows(new D(100000), new D(12), t)).toHaveLength(1)
  })
})

describe('effectiveYield', () => {
  it('7% quarterly is 7.1859% (1.0175^4 = 1.071859)', () => {
    expect(effectiveYield(new D(7), 4).toDecimalPlaces(4).toString()).toBe('7.1859')
    close(effectiveYield(new D(7), 4).div(100).plus(1), 1.0175 ** 4)
  })
  it('yearly compounding is the rate itself; monthly 12% is 12.6825%', () => {
    expect(effectiveYield(new D(8), 1).toString()).toBe('8')
    expect(effectiveYield(new D(12), 12).toDecimalPlaces(4).toString()).toBe('12.6825')
  })
})
