import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { emi, schedule, sum } from './loan'
import { extraEmiPlan } from './extraEmi'

const d = (x: string | number) => new D(x)
const plan = (p: string, rate: string, n: number, extra = '0', lump = '0') => extraEmiPlan(d(p), d(rate), n, d(extra), d(lump))!

describe('extra EMI plan', () => {
  it('with no extra it is exactly the standard schedule, row for row', () => {
    for (const [p, rate, n] of [['5000000', '8.5', 240], ['250000', '13.99', 37], ['100000', '0', 12], ['9999999.99', '24', 1]] as const) {
      const out = plan(p, rate, n)
      const base = schedule(d(p), d(rate), n)
      expect(out.rows).toHaveLength(n)
      out.rows.forEach((x, i) => {
        const b = base[i]!
        expect(x.month).toBe(b.month)
        for (const k of ['payment', 'interest', 'principal', 'balance'] as const) expect(x[k].eq(b[k]), `${p} ${rate} ${n} row ${i} ${k}`).toBe(true)
      })
      expect(out.monthsSaved).toBe(0)
      expect(out.interestSaved.abs().lt('1e-20')).toBe(true)
      expect(out.extraPaid.lt('1e-20')).toBe(true)
    }
  })

  // Hand-worked, rate 0 (no interest to argue about): 12,000 over 12 months is an EMI of 1,000.
  // Paying 1,000 extra a month means 2,000 a month, so 6 months, 6 saved, no interest either way.
  it('hand-worked, 0% rate: 12,000 over 12 months with 1,000 extra clears in 6 months', () => {
    const out = plan('12000', '0', 12, '1000')
    expect(out.months).toBe(6)
    expect(out.monthsSaved).toBe(6)
    expect(out.interest.isZero()).toBe(true)
    expect(out.extraPaid.toFixed()).toBe('6000')
    expect(out.rows[5]!.balance.isZero()).toBe(true)
  })

  // Hand-worked, rate 0: 1,200 over 24 months, EMI 50. After EMI 12 the balance is 600; a yearly lump of 600 clears it.
  it('hand-worked, 0% rate: a 600 yearly lump after EMI 12 clears a 1,200 / 24-month loan', () => {
    const out = plan('1200', '0', 24, '0', '600')
    expect(out.months).toBe(12)
    expect(out.monthsSaved).toBe(12)
    expect(out.extraPaid.toFixed()).toBe('600')
    expect(out.rows[11]!.payment.toFixed()).toBe('650') // the 50 EMI and the 600 lump
    expect(out.totalPaid.toFixed()).toBe('1200')
  })
  it('a lump is not taken when the loan already ended that month (monthly 50 + lump 300 on the same loan)', () => {
    const out = plan('1200', '0', 24, '50', '300')
    expect(out.months).toBe(12)
    expect(out.extraPaid.toFixed()).toBe('600') // 12 x 50 only; the lump finds nothing left
  })

  // Hand-worked with interest: 1,000 at 12% a year (1% a month) over 2 months.
  // EMI = 1000 x 0.01 x 1.01^2 / (1.01^2 - 1) = 10.201 / 0.0201 = 507.51243781...
  // Plain loan interest = 2 x 507.51243781 - 1000 = 15.02487562.
  // Paying 1,000 extra with the first EMI: month 1 interest 10, 1,010 is due and is all that is paid, so it ends in 1 month.
  it('hand-worked with interest: 1,000 at 12% for 2 months, 1,000 extra, ends in 1 month and saves 5.0249', () => {
    const out = plan('1000', '12', 2, '1000')
    expect(out.emi.toFixed(8)).toBe('507.51243781')
    expect(sum(out.base, 'interest').toFixed(8)).toBe('15.02487562')
    expect(out.months).toBe(1)
    expect(out.interest.toFixed(8)).toBe('10.00000000')
    expect(out.interestSaved.toFixed(8)).toBe('5.02487562')
    // Only what was due is paid: 1,010, of which the EMI is 507.51 and the rest (502.49) counts as extra.
    expect(out.rows[0]!.payment.toFixed(2)).toBe('1010.00')
    expect(out.extraPaid.toFixed(2)).toBe('502.49')
  })

  // Cross-check with the standard NPER formula (Excel =NPER): n = ln(pay / (pay - P*r)) / ln(1 + r).
  // 50 lakh at 8.5% for 20 years, EMI 43,391.16, with 10,000 extra a month.
  it('months match the NPER formula for a monthly extra (50 lakh, 8.5%, 20 years, +10,000)', () => {
    const p = 5_000_000
    const r = 0.085 / 12
    const pay = emi(d(p), d('8.5'), 240).plus(10000).toNumber()
    const nper = Math.log(pay / (pay - p * r)) / Math.log(1 + r)
    const out = plan('5000000', '8.5', 240, '10000')
    expect(out.months).toBe(Math.ceil(nper))
    expect(out.rows.at(-1)!.balance.isZero()).toBe(true)
    // The last payment is only what is left: no more than a full EMI plus the extra.
    expect(out.rows.at(-1)!.payment.lte(out.emi.plus(10000))).toBe(true)
  })

  it('property: principal adds back to the loan, balance never goes up, saving grows with the extra (with a lump too)', () => {
    let lastSaved = d(0)
    for (const extra of ['0', '1000', '5000', '20000']) {
      const out = plan('3000000', '9.25', 180, extra, '50000')
      expect(sum(out.rows, 'principal').minus('3000000').abs().lt('1e-18')).toBe(true)
      expect(out.rows.at(-1)!.balance.isZero()).toBe(true)
      for (let i = 1; i < out.rows.length; i++) expect(out.rows[i]!.balance.lte(out.rows[i - 1]!.balance)).toBe(true)
      expect(out.interestSaved.gte(lastSaved)).toBe(true)
      lastSaved = out.interestSaved
      // Money in = money out: payments = loan + interest.
      expect(out.totalPaid.minus(d('3000000').plus(out.interest)).abs().lt('1e-18')).toBe(true)
    }
  })

  it('refuses a negative extra or lump', () => {
    expect(extraEmiPlan(d(1000), d(10), 12, d(-1), d(0))).toBeNull()
    expect(extraEmiPlan(d(1000), d(10), 12, d(0), d(-1))).toBeNull()
  })
})
