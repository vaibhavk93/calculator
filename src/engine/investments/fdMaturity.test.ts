import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { parseDate, toIso } from '../everyday/dates'
import { effectiveYield, fd } from './invest'
import { fdMaturity, maturityDate, type FdComp } from './fdMaturity'
import type { TimeUnit } from '../duration'

const d = (x: string | number) => new D(x)
const date = (s: string) => parseDate(s)!
const run = (p: string, rate: string, n: string, unit: TimeUnit, start: string, comp: FdComp) => fdMaturity(d(p), d(rate), d(n), unit, date(start), comp)!
const on = (x: Date) => toIso(x)

describe('FD value: hand-worked', () => {
  // 1.0175^20 = 1.4147781957..., the same figure the FD ladder test uses.
  it('1,00,000 at 7% compounded quarterly for 5 years = 1,41,477.82', () => {
    const r = run('100000', '7', '5', 'years', '2026-11-11', 'quarterly')
    expect(r.amount.toFixed(2)).toBe('141477.82')
    expect(r.interest.toFixed(2)).toBe('41477.82')
  })
  // 1.01^12 = 1.12682503013 (12% a year, 1% a month)
  it('1,00,000 at 12% compounded monthly for 1 year = 1,12,682.50', () => {
    expect(run('100000', '12', '1', 'years', '2026-11-11', 'monthly').amount.toFixed(2)).toBe('112682.50')
  })
  it('1,00,000 at 10% compounded yearly for 2 years = 1,21,000', () => {
    expect(run('100000', '10', '24', 'months', '2026-11-11', 'yearly').amount.toFixed(2)).toBe('121000.00')
  })
  // Simple interest at maturity: 1,00,000 x (1 + 7.5% x 1.5) = 1,11,250
  it('at maturity (simple): 1,00,000 at 7.5% for 18 months = 1,11,250', () => {
    const r = run('100000', '7.5', '18', 'months', '2026-11-11', 'maturity')
    expect(r.amount.toFixed(2)).toBe('111250.00')
    expect(r.interest.toFixed(2)).toBe('11250.00')
  })
  // 1.0175^(4 x 90 / 365) = 1.017258..., the audit figure for 90 days at 7% quarterly
  it('90 days at 7% quarterly = 1,01,725.82 (part period compounds fractionally, flagged)', () => {
    const r = run('100000', '7', '90', 'days', '2026-11-11', 'quarterly')
    expect(r.amount.toFixed(2)).toBe('101725.82')
    expect(r.partPeriod).toBe(true)
  })
  it('whole compounding periods are not a part period', () => {
    expect(run('100000', '7', '6', 'months', '2026-11-11', 'quarterly').partPeriod).toBe(false)
    expect(run('100000', '7', '7', 'months', '2026-11-11', 'quarterly').partPeriod).toBe(true)
    expect(run('100000', '7', '7', 'months', '2026-11-11', 'monthly').partPeriod).toBe(false)
    expect(run('100000', '7', '7', 'months', '2026-11-11', 'maturity').partPeriod).toBe(false)
  })
  it('the same tenure in months, years or days of a 365-day year gives the same value', () => {
    const a = run('250000', '6.8', '18', 'months', '2026-11-11', 'quarterly').amount
    const b = run('250000', '6.8', '1.5', 'years', '2026-11-11', 'quarterly').amount
    expect(a.eq(b)).toBe(true)
    expect(run('250000', '6.8', '365', 'days', '2026-11-11', 'yearly').amount.eq(run('250000', '6.8', '1', 'years', '2026-11-11', 'yearly').amount)).toBe(true)
  })
})

describe('FD value: cross-checks', () => {
  // The existing `fd` tool's formula P(1 + r/n)^(nt), and the exp/log form in plain floats.
  it('agrees with the fd() engine and with an exp/log float calculation for monthly, quarterly and yearly', () => {
    for (const [comp, n] of [['monthly', 12], ['quarterly', 4], ['yearly', 1]] as const) {
      for (const [p, rate, years] of [[100000, 7, 5], [350000, 6.35, 2.5], [75000, 8.25, 0.75]] as const) {
        const r = run(String(p), String(rate), String(years), 'years', '2026-11-11', comp)
        expect(r.amount.eq(fd(d(p), d(rate), d(years), n))).toBe(true)
        const float = p * Math.exp(n * years * Math.log(1 + rate / 100 / n))
        expect(r.amount.minus(float).abs().lt('1e-6'), `${comp} ${p} ${rate} ${years}`).toBe(true)
      }
    }
  })
  it('effective yearly yield equals the standard formula for whole periods (7% quarterly = 7.1859%)', () => {
    const r = run('100000', '7', '5', 'years', '2026-11-11', 'quarterly')
    expect(r.effectivePct.minus(effectiveYield(d(7), 4)).abs().lt('1e-20')).toBe(true)
    expect(r.effectivePct.toFixed(4)).toBe('7.1859')
  })
  it('more frequent compounding never gives less (maturity <= yearly <= quarterly <= monthly)', () => {
    const v = (c: FdComp) => run('100000', '9', '4', 'years', '2026-11-11', c).amount
    expect(v('maturity').lte(v('yearly'))).toBe(true)
    expect(v('yearly').lt(v('quarterly'))).toBe(true)
    expect(v('quarterly').lt(v('monthly'))).toBe(true)
  })
  it('rate 0 returns the principal', () => {
    const r = run('50000', '0', '1', 'years', '2026-11-11', 'quarterly')
    expect(r.amount.toFixed()).toBe('50000')
    expect(r.interest.isZero()).toBe(true)
  })
})

describe('FD maturity date: calendar-correct', () => {
  it('months: 31 Jan + 1 month = 28 Feb; 29 Feb 2028 + 12 months = 28 Feb 2029', () => {
    expect(on(maturityDate(date('2027-01-31'), d(1), 'months')!)).toBe('2027-02-28')
    expect(on(maturityDate(date('2028-01-31'), d(1), 'months')!)).toBe('2028-02-29')
    expect(on(maturityDate(date('2028-02-29'), d(12), 'months')!)).toBe('2029-02-28')
  })
  it('years: whole years and a year and a quarter (15 months)', () => {
    expect(on(maturityDate(date('2026-11-11'), d(5), 'years')!)).toBe('2031-11-11')
    expect(on(maturityDate(date('2026-11-30'), d('1.25'), 'years')!)).toBe('2028-02-29') // 15 months, 30 Feb does not exist: clamps to the 29th
    expect(on(maturityDate(date('2026-08-31'), d('1.5'), 'years')!)).toBe('2028-02-29')
  })
  it('days: 90 days from 11 Nov 2026 is 9 Feb 2027; 365 days from 1 Mar 2027 is 29 Feb 2028 (leap year)', () => {
    expect(on(maturityDate(date('2026-11-11'), d(90), 'days')!)).toBe('2027-02-09')
    expect(on(maturityDate(date('2027-03-01'), d(365), 'days')!)).toBe('2028-02-29')
  })
  it('a part month becomes whole days at 365 a year, half up (0.7 years = 255.5 -> 256 days)', () => {
    expect(on(maturityDate(date('2026-01-01'), d('0.7'), 'years')!)).toBe(on(maturityDate(date('2026-01-01'), d(256), 'days')!))
    expect(on(maturityDate(date('2026-01-01'), d('1.5'), 'months')!)).toBe(on(maturityDate(date('2026-01-01'), d(46), 'days')!)) // 1.5/12 x 365 = 45.625
  })
  it('days that are not whole have no date', () => {
    expect(maturityDate(date('2026-01-01'), d('10.5'), 'days')).toBeNull()
  })
  it('the day count between start and maturity is the real calendar count', () => {
    expect(run('100000', '7', '1', 'years', '2027-03-01', 'quarterly').days).toBe(366) // crosses 29 Feb 2028
    expect(run('100000', '7', '1', 'years', '2026-03-01', 'quarterly').days).toBe(365)
  })
})

describe('FD: refused input', () => {
  const ok = (p: string, rate: string, n: string, unit: TimeUnit) => fdMaturity(d(p), d(rate), d(n), unit, date('2026-11-11'), 'quarterly')
  it('returns null, never NaN', () => {
    expect(ok('0', '7', '1', 'years')).toBeNull()
    expect(ok('-5', '7', '1', 'years')).toBeNull()
    expect(ok('1000', '-1', '1', 'years')).toBeNull()
    expect(ok('1000', '100.5', '1', 'years')).toBeNull()
    expect(ok('1000', '7', '0', 'years')).toBeNull()
    expect(ok('1000', '7', '51', 'years')).toBeNull()
    expect(ok('1000', '7', '18251', 'days')).toBeNull()
    expect(ok('1000', '7', '10.5', 'days')).toBeNull()
    expect(ok('1000', '7', '1', 'years')).not.toBeNull()
  })
})
