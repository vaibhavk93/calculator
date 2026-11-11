import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { parseDate } from '../everyday/dates'
import { goalSip, sipFutureValue, sipMonths } from './invest'
import { goalSipByMonths, monthsUntil } from './goalSip'

const d = (x: string | number) => new D(x)
const plan = (target: string, rate: string, months: number, existing = '0', step = '0') => goalSipByMonths(d(target), d(rate), months, d(existing), d(step))!
const date = (s: string) => parseDate(s)!

describe('goal SIP by date: compounding convention (monthly at rate / 12, payment at the start of the month)', () => {
  // Hand-worked, one month: 1,000 goes in at the start, grows 1% (12% / 12) in the month, so 1,010 at the end.
  // To have 1,010 after one month the SIP is 1,000.
  it('hand-worked: 1 month at 12% to reach 1,010 needs 1,000', () => {
    expect(plan('1010', '12', 1).sip.toFixed(10)).toBe('1000.0000000000')
  })
  // Hand-worked, 12 months at 12%: i = 0.01, factor = (1.01^12 - 1) / 0.01 x 1.01 = 12.682503013 x 1.01 = 12.80932804.
  // 1,00,000 / 12.80932804 = 7,806.81 (also worked in exact fractions outside the app: 7806.810760...).
  it('hand-worked: 1,00,000 in 12 months at 12% needs 7,806.81 a month', () => {
    const p = plan('100000', '12', 12)
    expect(p.sip.toFixed(4)).toBe('7806.8108')
    expect(p.invested.toFixed(2)).toBe('93681.73')
  })
  // Existing 20,000 grows MONTHLY here: 20,000 x 1.01^12 = 22,536.50 (the yearly convention would give 22,400).
  // The rest, 77,463.50, is built by the SIP: 77,463.50 / 12.80932804 = 6,047.43.
  it('hand-worked: 20,000 already saved grows monthly to 22,536.50, so the SIP drops to 6,047.43', () => {
    const p = plan('100000', '12', 12, '20000')
    expect(p.savedGrown.toFixed(2)).toBe('22536.50')
    expect(p.sip.toFixed(4)).toBe('6047.4288')
    // the older yearly rule would have grown it to only 22,400 and asked for more
    const older = goalSip(d(100000), d(12), 1, d(20000))!
    expect(older.gt(p.sip)).toBe(true)
  })
  it('ten lakh in 5 years at 12% needs 12,123.22 a month (exact fractions: 12123.2155...)', () => {
    expect(plan('1000000', '12', 60).sip.toFixed(4)).toBe('12123.2155')
  })

  // Cross-check with the closed form P x ((1+i)^n - 1) / i x (1+i) from `sipFutureValue`.
  it('the SIP times the closed-form factor, plus the saved money grown, equals the target', () => {
    for (const [t, r, m, e] of [['2500000', '11', 84, '150000'], ['750000', '7.5', 30, '0'], ['500000', '0', 20, '10000']] as const) {
      const p = plan(t, r, m, e)
      const fv = sipFutureValue(p.sip, d(r), m)
      expect(fv.plus(p.savedGrown).minus(t).abs().lt('1e-12'), `${t} ${r} ${m}`).toBe(true)
    }
  })
  it('rate 0: the SIP is just the gap over the months', () => {
    expect(plan('120000', '0', 24, '24000').sip.toFixed()).toBe('4000')
  })
})

describe('goal SIP by date: yearly step-up', () => {
  // Hand-worked at 0%: 24 months with a 10% raise = 12 months of P and 12 months of 1.1 P = 25.2 P. 25,200 needs P = 1,000.
  it('hand-worked at 0%: 25,200 over 24 months with a 10% step-up starts at 1,000 and ends at 1,100', () => {
    const p = plan('25200', '0', 24, '0', '10')
    expect(p.sip.toFixed(8)).toBe('1000.00000000')
    expect(p.lastSip.toFixed(8)).toBe('1100.00000000')
    expect(p.invested.toFixed(8)).toBe('25200.00000000')
  })
  // Exact fractions, 12% and 10% step-up over 24 months: factor 28.52413231, so 10 lakh needs 35,058.03 to start.
  it('12% return and 10% step-up: 10 lakh in 24 months starts at 35,058.03', () => {
    expect(plan('1000000', '12', 24, '0', '10').sip.toFixed(4)).toBe('35058.0340')
  })
  it('the SIP schedule hits the target (independent month loop)', () => {
    const p = plan('1500000', '10', 40, '50000', '8')
    let bal = d(0)
    let amt = p.sip
    for (let m = 1; m <= 40; m++) {
      bal = bal.plus(amt).times(d(1).plus(d(10).div(1200)))
      if (m % 12 === 0) amt = amt.times('1.08')
    }
    expect(bal.plus(p.savedGrown).minus('1500000').abs().lt('1e-12')).toBe(true)
    expect(sipMonths(p.sip, d(10), 40, d(8)).at(-1)!.value.eq(bal)).toBe(true)
    // the last SIP is the 4th year's (months 37 to 40): 3 raises
    expect(p.lastSip.eq(p.sip.times(d('1.08').pow(3)))).toBe(true)
  })
  it('a step-up lowers the starting SIP', () => {
    expect(plan('1000000', '12', 120, '0', '10').sip.lt(plan('1000000', '12', 120).sip)).toBe(true)
  })
})

describe('goal SIP by date: edge cases', () => {
  it('savings that already reach the target need no SIP', () => {
    const p = plan('100000', '12', 12, '200000')
    expect(p.sip.isZero()).toBe(true)
    expect(p.gap.isZero()).toBe(true)
  })
  it('refuses no months and negative inputs', () => {
    expect(goalSipByMonths(d(1000), d(12), 0, d(0))).toBeNull()
    expect(goalSipByMonths(d(1000), d(-1), 12, d(0))).toBeNull()
    expect(goalSipByMonths(d(1000), d(12), 12, d(-1))).toBeNull()
    expect(goalSipByMonths(d(1000), d(12), 12, d(0), d(-5))).toBeNull()
  })
})

describe('monthsUntil: whole months, a part month counts as a full one, calendar-correct', () => {
  it('exact years and months', () => {
    expect(monthsUntil(date('2026-11-11'), date('2027-11-11'))).toBe(12)
    expect(monthsUntil(date('2026-11-11'), date('2026-12-11'))).toBe(1)
  })
  it('a part month rounds up', () => {
    expect(monthsUntil(date('2026-11-11'), date('2027-11-12'))).toBe(13)
    expect(monthsUntil(date('2026-11-11'), date('2026-11-12'))).toBe(1)
  })
  it('month-end safe: 31 Jan to 28 Feb is one month, to 1 Mar is two', () => {
    expect(monthsUntil(date('2027-01-31'), date('2027-02-28'))).toBe(1)
    expect(monthsUntil(date('2027-01-31'), date('2027-03-01'))).toBe(2)
    expect(monthsUntil(date('2028-01-31'), date('2028-02-29'))).toBe(1)
  })
  it('today or the past is not a future date', () => {
    expect(monthsUntil(date('2026-11-11'), date('2026-11-11'))).toBeNull()
    expect(monthsUntil(date('2026-11-11'), date('2026-11-10'))).toBeNull()
  })
})
