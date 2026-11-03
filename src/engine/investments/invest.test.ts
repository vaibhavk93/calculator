import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { cagr, epf, fd, goalSip, growCorpus, lumpsum, ppf, rd, sip, sipFutureValue, swp, xirr } from './invest'

const r2 = (v: { toFixed(n: number): string }) => v.toFixed(2)

describe('SIP (annuity-due, monthly rate = annual/12)', () => {
  // External: Rs 5,000/month, 12%, 10 years = Rs 11,61,695 — the figure Groww's and most Indian SIP
  // calculators publish for this case (they use the same start-of-month convention).
  it('matches the widely published 5,000 × 12% × 10y figure', () => {
    expect(sipFutureValue(new D(5000), new D(12), 120).toFixed(0)).toBe('1161695')
  })
  // Independent recomputation: the month-by-month simulation must equal the closed form.
  it('month-by-month simulation equals the closed form', () => {
    const rows = sip(new D(5000), new D(12), 10)
    expect(r2(rows[9]!.value)).toBe(r2(sipFutureValue(new D(5000), new D(12), 120)))
    expect(rows[9]!.invested.toFixed()).toBe('600000')
  })
  it('zero return is just the money put in', () => {
    expect(sipFutureValue(new D(1000), new D(0), 24).toFixed()).toBe('24000')
  })
  // Independent recomputation of step-up: year 2 pays 5,500/month (10% up).
  it('step-up raises the amount each year', () => {
    const rows = sip(new D(5000), new D(12), 2, new D(10))
    expect(rows[1]!.invested.toFixed()).toBe('126000')
    const y1 = sipFutureValue(new D(5000), new D(12), 12)
    const expected = y1.times(new D('1.01').pow(12)).plus(sipFutureValue(new D(5500), new D(12), 12))
    expect(r2(rows[1]!.value)).toBe(r2(expected))
  })
})

describe('Lumpsum', () => {
  // External: 1,00,000 at 12% for 10 years = 3,10,585 (1.12^10 = 3.1058482), standard compound-interest table.
  it('compounds yearly', () => expect(lumpsum(new D(100000), new D(12), 10)[9]!.value.toFixed(0)).toBe('310585'))
})

describe('Goal SIP', () => {
  // Independent recomputation: the required SIP fed back into the SIP formula gives the target.
  it('round-trips through the SIP formula', () => {
    const p = goalSip(new D(1000000), new D(12), 10, new D(0))!
    expect(sipFutureValue(p, new D(12), 120).toFixed(6)).toBe('1000000.000000')
  })
  it('is zero when the existing corpus already gets there', () => {
    expect(goalSip(new D(100000), new D(10), 10, new D(50000))!.toFixed()).toBe('0')
  })
  it('null with no time', () => expect(goalSip(new D(1), new D(10), 0, new D(0))).toBeNull())
})

describe('SWP', () => {
  // Independent recomputation (not externally verified): closed form of the depletion month,
  // n = −ln(1 − B·i/W) / ln(1+i) = 165.9 for 10 lakh, 10,000/month, 8%. So 165 full withdrawals.
  it('counts the months the corpus lasts', () => {
    const r = swp(new D(1000000), new D(10000), new D(8))
    expect(r.months).toBe(165)
    expect(r.totalWithdrawn.gt(1650000)).toBe(true)
  })
  it('never runs out when interest covers the withdrawal', () => {
    expect(swp(new D(1000000), new D(5000), new D(8)).months).toBeNull()
  })
})

describe('FD', () => {
  // Not externally verified. Independent recomputation: 1.0175^20 = 1.41477820 (checked with
  // Python floats), so 1,00,000 at 7% quarterly for 5 years = 1,41,477.82.
  it('quarterly compounding', () => expect(r2(fd(new D(100000), new D(7), new D(5), 4))).toBe('141477.82'))
  it('yearly compounding equals lumpsum', () => {
    expect(r2(fd(new D(100000), new D(12), new D(10), 1))).toBe(r2(lumpsum(new D(100000), new D(12), 10)[9]!.value))
  })
})

describe('RD', () => {
  // External: India Post's RD table: Rs 100/month for 5 years at 6.7% matures at Rs 7,137 (rounded),
  // as reproduced from India Post's calculator; quarterly compounding.
  it('matches the India Post 100/month × 6.7% × 5y figure', () => {
    expect(rd(new D(100), new D('6.7'), 60).toFixed(0)).toBe('7137')
  })
  // Independent recomputation: closed form R(q^(N/3) − 1) / (1 − q^(−1/3)), q = 1 + r/4.
  it('equals the bank closed form', () => {
    const q = new D(1).plus(new D('0.07').div(4))
    const closed = new D(5000).times(q.pow(4).minus(1)).div(new D(1).minus(q.pow(new D(-1).div(3))))
    expect(r2(rd(new D(5000), new D(7), 12))).toBe(r2(closed))
  })
})

describe('PPF', () => {
  // External: 1,50,000 a year for 15 years at 7.1% = Rs 40,68,209, the figure SBI/Groww PPF calculators
  // publish (deposit before 5 April, interest credited yearly).
  it('15 years of the maximum deposit', () => {
    const rows = ppf(new D(150000), new D('7.1'), 15)
    expect(rows[14]!.value.toFixed(0)).toBe('4068209')
    expect(rows[14]!.invested.toFixed()).toBe('2250000')
  })
})

describe('EPF', () => {
  // Independent recomputation (not externally verified). Basic 10,000, 12% + 12%, EPS 8.33% (under the
  // ceiling): employer EPF = 1,200 − 833 = 367, so 1,567 a month. Interest at 8.25%/12 on the running
  // balance: 1,567 × (1+2+…+12) × 0.006875 = 840.30. Year 1 = 18,804 + 840.30.
  it('one year, salary under the ceiling', () => {
    const rows = epf({
      basic: new D(10000), employeePct: new D(12), employerPct: new D(12), growthPct: new D(0), years: 1,
      ratePct: new D('8.25'), epsSharePct: new D('8.33'), wageCeiling: new D(15000),
    })
    expect(rows[0]!.invested.toFixed()).toBe('18804')
    expect(r2(rows[0]!.value)).toBe('19644.30')
  })
  it('caps the pension part at the wage ceiling', () => {
    const rows = epf({
      basic: new D(50000), employeePct: new D(12), employerPct: new D(12), growthPct: new D(0), years: 1,
      ratePct: new D(0), epsSharePct: new D('8.33'), wageCeiling: new D(15000),
    })
    // 6,000 + (6,000 − 1,249.50) = 10,750.50 a month
    expect(rows[0]!.invested.toFixed()).toBe('129006')
  })
})

describe('CAGR', () => {
  // Independent recomputation: 1 lakh to 2 lakh in 6 years = 2^(1/6) − 1 = 12.2462%.
  it('doubling in 6 years', () => expect(cagr(new D(100000), new D(200000), new D(6))!.toFixed(4)).toBe('12.2462'))
  it('undefined cases are null', () => {
    expect(cagr(new D(0), new D(5), new D(1))).toBeNull()
    expect(cagr(new D(5), new D(5), new D(0))).toBeNull()
  })
})

describe('XIRR', () => {
  const f = (rows: [string, number][]) => rows.map(([d, a]) => ({ date: new Date(d + 'T00:00:00Z'), amount: new D(a) }))
  // External: Microsoft's Excel XIRR documentation example. Result 0.373362535 (37.34%). Excel stops
  // iterating at 0.000001%, so its last digit differs; we match to 8 places.
  // https://support.microsoft.com/en-us/office/xirr-function-de1242ec-6477-445b-b11b-a303ad9adc9d
  it('matches the Excel documentation example', () => {
    const r = xirr(f([['2008-01-01', -10000], ['2008-03-01', 2750], ['2008-10-30', 4250], ['2009-02-15', 3250], ['2009-04-01', 2750]]))
    expect('rate' in r && r.rate.toFixed(8)).toBe('0.37336253')
  })
  // Independent recomputation: -100 then +110 exactly 365 days later is 10%. Order of rows does not matter.
  it('one year at 10%, rows out of order', () => {
    const r = xirr(f([['2024-01-01', 110], ['2023-01-01', -100]]))
    expect('rate' in r && r.rate.toFixed(6)).toBe('0.100000')
  })
  it('a large loss still solves (bisection range)', () => {
    const r = xirr(f([['2020-01-01', -1000], ['2021-01-01', 10]]))
    expect('rate' in r && r.rate.lt(-0.98)).toBe(true)
  })
  it('plain errors', () => {
    expect(xirr(f([['2020-01-01', -1]]))).toEqual({ error: 'too-few' })
    expect(xirr(f([['2020-01-01', 1], ['2021-01-01', 2]]))).toEqual({ error: 'no-sign-change' })
  })
})

// Not an outside source: 1.01^12 = 1.126825030131969... is a known constant, so 12 months at 12% turns 10,00,000 into 11,26,825.03.
describe('SWP, saving years at a different rate (growCorpus)', () => {
  it('12 months at 12% grows 10,00,000 to 11,26,825.03', () => {
    expect(r2(growCorpus(new D(1000000), new D(12), 12))).toBe('1126825.03')
  })
  it('0 months leaves the corpus unchanged, so an old SWP card gives the same answer', () => {
    expect(growCorpus(new D(1000000), new D(12), 0).toFixed()).toBe('1000000')
  })
  it('a higher saving return starts the withdrawals from a bigger corpus, so the money lasts longer', () => {
    const flat = swp(new D(1000000), new D(10000), new D(8)).months!
    const grown = swp(growCorpus(new D(1000000), new D(12), 60), new D(10000), new D(8))
    expect(grown.months === null || grown.months > flat).toBe(true)
  })
})
