import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { KVP, MIS, NSC, OFFICIAL_TO, SCSS, SMALL_SAVINGS_SOURCE, SSY, TD } from './rates'
import { kvp, mis, nsc, scss, ssy, timeDeposit } from './smallSavings'

const d = (x: string | number) => new D(x)
const n = (x: { toString(): string }) => Number(x.toString())
const near = (x: { toString(): string }, want: number, tol = 0.005) => expect(Math.abs(n(x) - want)).toBeLessThan(tol)

describe('small-savings rules file (primary numbers, 2026-11-06)', () => {
  it('holds the Oct-Dec 2026 rates from the NSI pages and says to when they are official', () => {
    expect([SSY.rate, NSC.rate, SCSS.rate, KVP.rate, MIS.rate]).toEqual(['8.2', '7.7', '8.2', '7.5', '7.4'])
    expect(TD.rates).toEqual({ 1: '6.9', 2: '7', 3: '7.1', 5: '7.5' })
    expect(SMALL_SAVINGS_SOURCE).toContain('F.No.1/4/2019-NS')
    expect(OFFICIAL_TO).toBe('31 Dec 2026')
  })
  it('holds the scheme limits from the rule texts', () => {
    expect([SSY.minYearly, SSY.maxYearly, SSY.depositYears, SSY.termYears, SSY.openUntilAge]).toEqual(['250', '150000', 15, 21, 10])
    expect([SCSS.min, SCSS.max, SCSS.multiple]).toEqual(['1000', '3000000', '1000'])
    expect([MIS.maxSingle, MIS.maxJoint]).toEqual(['900000', '1500000'])
    expect([KVP.months, KVP.min, NSC.min, NSC.years]).toEqual([115, '1000', '1000', 5])
  })
})

describe('SSY', () => {
  it('matches the closed form: deposits for 15 years, interest to year 21', () => {
    const r = ssy(d(150000), d('8.2'))!
    expect(r).toHaveLength(21)
    // yearly x (1+i) x ((1+i)^15 - 1) / i x (1+i)^6, i = 0.082
    const i = d('0.082')
    const want = d(150000).times(i.plus(1)).times(i.plus(1).pow(15).minus(1)).div(i).times(i.plus(1).pow(6))
    expect(n(r[20]!.value)).toBeCloseTo(n(want), 4)
    expect(n(r[20]!.invested)).toBe(2250000)
  })
  it('stops depositing after year 15 but the balance keeps growing', () => {
    const r = ssy(d(1000), d(10))!
    expect(n(r[14]!.invested)).toBe(15000)
    expect(n(r[15]!.invested)).toBe(15000)
    expect(r[15]!.value.eq(r[14]!.value.times('1.1'))).toBe(true)
  })
  it('year 1: one deposit earns a full year', () => {
    near(ssy(d(10000), d('8.2'))![0]!.value, 10820)
  })
  it('refuses a deposit under 250 or over 1,50,000', () => {
    expect(ssy(d(249), d('8.2'))).toBeNull()
    expect(ssy(d(150001), d('8.2'))).toBeNull()
    expect(ssy(d(250), d('8.2'))).not.toBeNull()
    expect(ssy(d(150000), d('8.2'))).not.toBeNull()
  })
})

describe('NSC', () => {
  it('Rs 1,000 becomes Rs 1,449.03 at 7.7% (the research doc: 1.077^5)', () => {
    near(nsc(d(1000), d('7.7'))!.at(-1)!.value, 1449.03)
  })
  it('compounds yearly, one row a year', () => {
    const r = nsc(d(10000), d('7.7'))!
    expect(r).toHaveLength(5)
    near(r[0]!.value, 10770)
    near(r[1]!.value, 11599.29)
  })
  it('needs Rs 1,000 and then multiples of Rs 100', () => {
    expect(nsc(d(900), d('7.7'))).toBeNull()
    expect(nsc(d(1050), d('7.7'))).toBeNull()
    expect(nsc(d(1100), d('7.7'))).not.toBeNull()
  })
})

describe('SCSS', () => {
  it('Rs 30 lakh at 8.2% pays Rs 61,500 a quarter, Rs 2,46,000 a year, Rs 12,30,000 over 5 years', () => {
    const p = scss(d(3000000), d('8.2'))!
    expect(n(p.perPeriod)).toBe(61500)
    expect(n(p.yearly)).toBe(246000)
    expect(n(p.total)).toBe(1230000)
    expect(n(p.principal)).toBe(3000000)
  })
  it('multiples of Rs 1,000, at most Rs 30 lakh', () => {
    expect(scss(d(500), d('8.2'))).toBeNull()
    expect(scss(d(1500), d('8.2'))).toBeNull()
    expect(scss(d(3001000), d('8.2'))).toBeNull()
    expect(scss(d(1000), d('8.2'))).not.toBeNull()
  })
})

describe('MIS', () => {
  it('Rs 9 lakh at 7.4% pays Rs 5,550 a month and Rs 3,33,000 over 5 years', () => {
    const p = mis(d(900000), d('7.4'), false)!
    expect(n(p.perPeriod)).toBe(5550)
    expect(n(p.total)).toBe(333000)
  })
  it('Rs 9 lakh single, Rs 15 lakh joint', () => {
    expect(mis(d(900001), d('7.4'), false)).toBeNull()
    expect(mis(d(1500000), d('7.4'), true)).not.toBeNull()
    expect(mis(d(1500001), d('7.4'), true)).toBeNull()
    expect(n(mis(d(1500000), d('7.4'), true)!.perPeriod)).toBe(9250)
  })
})

describe('KVP', () => {
  it('doubles: Rs 1,00,000 becomes Rs 2,00,000 in 115 months', () => {
    const k = kvp(d(100000))!
    expect(n(k.maturity)).toBe(200000)
    expect(n(k.interest)).toBe(100000)
  })
  it('cross-check: doubling in 115 months is a yearly rate of 7.5%', () => {
    // 2^(12/115) - 1 = 0.07500... (and 1.075^(115/12) = 1.99985, the research doc's own arithmetic)
    near(kvp(d(1000))!.impliedYearlyPct, 7.5, 0.01)
    near(d('1.075').pow(d(115).div(12)), 1.99985, 0.00001)
  })
  it('needs Rs 1,000 at least', () => {
    expect(kvp(d(999))).toBeNull()
  })
})

describe('Time deposit', () => {
  it('compounded in (left in): Rs 1,00,000 for 5 years at 7.5% quarterly is 1.01875^20', () => {
    const t = timeDeposit(d(100000), d('7.5'), 5, false)!
    near(t.maturity, 144995, 1) // 1.01875^20 = 1.44995 (ln 1.01875 x 20 = 0.37153)
    expect(t.rows).toHaveLength(5)
  })
  it('paid out: the deposit stays, each year pays 1.01875^4 - 1 of it', () => {
    const t = timeDeposit(d(100000), d('7.5'), 5, true)!
    near(t.yearly, 7713.6, 0.1) // 1.01875^4 = 1.077136
    near(t.interest, 5 * n(t.yearly), 0.0001)
    near(t.maturity, 100000 + 5 * n(t.yearly), 0.0001)
  })
  it('the two readings agree in year 1', () => {
    const a = timeDeposit(d(50000), d(7), 1, true)!
    const b = timeDeposit(d(50000), d(7), 1, false)!
    expect(a.maturity.eq(b.maturity)).toBe(true)
  })
  it('refuses nonsense', () => {
    expect(timeDeposit(d(0), d(7), 1, true)).toBeNull()
    expect(timeDeposit(d(1000), d(-1), 1, true)).toBeNull()
    expect(timeDeposit(d(1000), d(7), 0, true)).toBeNull()
  })
})
