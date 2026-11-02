import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import {
  balanceTransfer,
  byYear,
  cardEmi,
  compoundInterest,
  effectiveAnnualPct,
  emi,
  maxLoan,
  prepay,
  rateChange,
  schedule,
  simpleInterest,
  sum,
} from './loan'

const d = (x: string | number) => new D(x)
const r2 = (x: InstanceType<typeof D>) => x.toFixed(2)

describe('emi', () => {
  // External: Bajaj Finserv "Home loan EMI per lakh" (https://www.bajajfinserv.in/home-loan-emi-per-lakh):
  // Rs 1 lakh at 8.50% for 20 years is about Rs 868; their Rs 50 lakh page
  // (https://www.bajajfinservmarkets.in/home-loan/50-lakhs-home-loan-emi) gives Rs 43,391.
  it('matches a published lender EMI table', () => {
    expect(emi(d(100000), d('8.5'), 240).toFixed(0)).toBe('868')
    expect(emi(d(5000000), d('8.5'), 240).toFixed(0)).toBe('43391')
  })
  // External: Excel =PMT(10%/12, 240, -1000000) = 9,650.22 and =PMT(10%/12, 12, -100000) = 8,791.59.
  it('matches Excel PMT', () => {
    expect(r2(emi(d(1000000), d(10), 240))).toBe('9650.22')
    expect(r2(emi(d(100000), d(10), 12))).toBe('8791.59')
  })
  it('rate 0 is P / n', () => {
    expect(emi(d(120000), d(0), 12).toFixed()).toBe('10000')
  })
})

describe('schedule', () => {
  // Property check (independent of the EMI formula): paying the EMI every month must reach a zero
  // balance in exactly n months, and the principal column must add back to P.
  for (const [p, rate, n] of [
    ['5000000', '8.5', 360],
    ['250000', '13.99', 37],
    ['100000', '0', 12],
    ['9999999.99', '24', 1],
  ] as const) {
    it(`closes to 0 and principal sums to P (${p} at ${rate}% for ${n})`, () => {
      const rows = schedule(d(p), d(rate), n)
      expect(rows).toHaveLength(n)
      expect(rows[n - 1]!.balance.isZero()).toBe(true)
      expect(sum(rows, 'principal').minus(p).abs().lt('1e-20')).toBe(true)
      // Every instalment equals the EMI (the last only differs by full-precision dust).
      const e = emi(d(p), d(rate), n)
      for (const x of rows) expect(x.payment.minus(e).abs().lt('1e-20')).toBe(true)
    })
  }
  it('rolls 360 months into 30 years', () => {
    const years = byYear(schedule(d(5000000), d('8.5'), 360))
    expect(years).toHaveLength(30)
    expect(years[29]!.balance.isZero()).toBe(true)
    expect(r2(years.reduce((s, y) => s.plus(y.principal), d(0)))).toBe('5000000.00')
  })
})

describe('maxLoan', () => {
  // Independent recomputation: the EMI of the maximum loan must be the EMI we started from.
  it('is the inverse of emi', () => {
    const p = maxLoan(d(40000), d('8.5'), 240)
    expect(r2(emi(p, d('8.5'), 240))).toBe('40000.00')
    expect(maxLoan(d(1000), d(0), 12).toFixed()).toBe('12000')
  })
})

describe('prepay', () => {
  const P = d(5000000)
  const R = d('8.5')
  it('reduce EMI: new EMI is the EMI of the reduced balance over the remaining months', () => {
    const out = prepay(P, R, 240, d(500000), 24, 'reduceEmi')
    if (out === null || out === 'clears') throw new Error('expected a result')
    const balAfter24 = schedule(P, R, 240)[23]!.balance
    expect(r2(out.newEmi)).toBe(r2(emi(balAfter24.minus(500000), R, 216)))
    expect(out.months).toBe(240)
    expect(out.interestSaved.gt(0)).toBe(true)
    expect(out.rows[239]!.balance.isZero()).toBe(true)
  })
  it('reduce tenure: months match the NPER formula, a different method', () => {
    const out = prepay(P, R, 240, d(500000), 24, 'reduceTenure')
    if (out === null || out === 'clears') throw new Error('expected a result')
    const e = emi(P, R, 240).toNumber()
    const bal = schedule(P, R, 240)[23]!.balance.minus(500000).toNumber()
    const r = 8.5 / 1200
    const nper = -Math.log(1 - (r * bal) / e) / Math.log(1 + r)
    expect(out.months).toBe(24 + Math.ceil(nper))
    expect(out.monthsSaved).toBe(240 - out.months)
    expect(r2(sum(out.rows, 'principal'))).toBe('4500000.00')
  })
  it('a prepayment bigger than the balance clears the loan', () => {
    expect(prepay(P, R, 240, d(9000000), 24, 'reduceTenure')).toBe('clears')
    expect(prepay(P, R, 240, d(1), 240, 'reduceTenure')).toBeNull()
  })
})

describe('rateChange', () => {
  const P = d(5000000)
  it('keep tenure: new EMI over the remaining months at the new rate', () => {
    const out = rateChange(P, d('8.5'), 240, d(9), 13, 'keepTenure')!
    const bal = schedule(P, d('8.5'), 240)[11]!.balance
    expect(r2(out.newEmi)).toBe(r2(emi(bal, d(9), 228)))
    expect(out.months).toBe(240)
    expect(out.extraInterest.gt(0)).toBe(true)
  })
  it('keep EMI: a higher rate makes the loan longer', () => {
    const out = rateChange(P, d('8.5'), 240, d(9), 13, 'keepEmi')!
    expect(out.months).toBeGreaterThan(240)
    expect(out.rows[out.rows.length - 1]!.balance.isZero()).toBe(true)
  })
  it('never ends when the EMI no longer covers the interest', () => {
    expect(rateChange(P, d('8.5'), 240, d(20), 13, 'keepEmi')).toBeNull()
  })
})

describe('effectiveAnnualPct', () => {
  // Independent check: with no fees, the effective annual cost of a loan is (1 + r/12)^12 − 1.
  it('recovers the compounded nominal rate', () => {
    const rows = schedule(d(100000), d(12), 24)
    const eff = effectiveAnnualPct(d(100000), rows.map((x) => x.payment))!
    expect(eff.toFixed(4)).toBe(d('1.01').pow(12).minus(1).times(100).toFixed(4))
  })
  it('is 0 for an interest-free, fee-free loan', () => {
    expect(effectiveAnnualPct(d(1200), Array(12).fill(d(100)))!.abs().lt('1e-10')).toBe(true)
  })
})

describe('simple and compound interest', () => {
  // External: NCERT Class 8 Mathematics, "Comparing Quantities" worked examples:
  // CI on Rs 12,600 for 2 years at 10% compounded annually = Rs 2,646;
  // Rs 8,000 at 10% a year compounded half-yearly for 1 year: CI = Rs 820.
  it('matches NCERT examples', () => {
    expect(compoundInterest(d(12600), d(10), d(2), 1).toFixed(2)).toBe('2646.00')
    expect(compoundInterest(d(8000), d(10), d(1), 2).toFixed(2)).toBe('820.00')
    expect(simpleInterest(d(12600), d(10), d(2)).toFixed()).toBe('2520')
  })
})

describe('balanceTransfer', () => {
  // Independent recomputation by hand from two EMIs.
  it('break-even month and net saving', () => {
    const out = balanceTransfer(d(4000000), d('9.5'), 180, d('8.5'), d(20000))
    const per = emi(d(4000000), d('9.5'), 180).minus(emi(d(4000000), d('8.5'), 180))
    expect(r2(out.perMonth)).toBe(r2(per))
    expect(out.breakeven).toBe(Math.ceil(20000 / per.toNumber()))
    expect(r2(out.netSaving)).toBe(r2(per.times(180).minus(20000)))
  })
  it('no break-even when the new rate is not lower', () => {
    expect(balanceTransfer(d(100000), d(9), 12, d(9), d(500)).breakeven).toBeNull()
  })
})

describe('cardEmi', () => {
  // Not externally verified as a whole (no official worked example found). Checked by hand:
  // GST is 18% of the summed interest and of the fee; a no-cost EMI (0%) costs only the fee + its GST.
  it('adds 18% GST to interest and fee', () => {
    const out = cardEmi(d(60000), d(15), 12, d(199), d(18))
    const interest = sum(schedule(d(60000), d(15), 12), 'interest')
    expect(r2(out.gstOnInterest)).toBe(r2(interest.times('0.18')))
    expect(r2(out.total)).toBe(r2(d(60000).plus(interest.times('1.18')).plus(d(199).times('1.18'))))
    expect(out.effective!.gt(d('1.0125').pow(12).minus(1).times(100))).toBe(true)
  })
  it('no-cost EMI still costs the fee', () => {
    const out = cardEmi(d(30000), d(0), 6, d(199), d(18))
    expect(r2(out.extra)).toBe('234.82')
    expect(out.effective!.gt(0)).toBe(true)
  })
})
