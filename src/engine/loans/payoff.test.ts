import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { asScheduled, neverEnds, partPay, partPayTarget, payoffPlan, runway, type Debt } from './payoff'

const d = (x: string | number) => new D(x)
const debt = (name: string, balance: number, ratePct: number, emi: number): Debt => ({ name, balance: d(balance), ratePct: d(ratePct), emi: d(emi) })

// Hand-worked, one loan: Rs 1,000 at 12% a year (1% a month) with an EMI of 600.
//   month 1: interest 10.00, owed 1,010, pay 600, left 410
//   month 2: interest  4.10, owed  414.10, the last instalment is only 414.10, left 0
// so two months and 14.10 of interest. The last instalment is smaller than the EMI.
describe('one loan, by hand', () => {
  const one = [debt('X', 1000, 12, 600)]
  it('ends in 2 months with 14.10 interest, last instalment smaller', () => {
    const p = payoffPlan(one, d(0), 'avalanche')!
    expect(p.months).toBe(2)
    expect(p.interest.toFixed(2)).toBe('14.10')
    expect(p.order).toEqual([{ name: 'X', month: 2 }])
    expect(asScheduled(one)!.interest.toFixed(2)).toBe('14.10')
  })
  it('an extra amount goes to the loan: 1,000, 12%, EMI 600 + 100 extra = 700', () => {
    // month 1: owed 1010, pay 700, left 310. month 2: interest 3.10, owed 313.10, pay 313.10.
    const p = payoffPlan(one, d(100), 'snowball')!
    expect(p.months).toBe(2)
    expect(p.interest.toFixed(2)).toBe('13.10')
  })
})

// Reference figures from an independent exact-fraction re-run of the same method (Python, Fraction),
// not from this code. See docs/VERIFICATION.md.
describe('two loans: A 1,000 at 24% EMI 100, B 500 at 12% EMI 100', () => {
  const loans = [debt('A', 1000, 24, 100), debt('B', 500, 12, 100)]
  // month 1 by hand: A interest 20 -> 1,020 owed, pay 100 -> 920. B interest 5 -> 505 owed, pay 100 -> 405.
  it('with no extra, both orders agree: B clears in month 6, A in month 9 (freed EMI rolls into A)', () => {
    for (const s of ['avalanche', 'snowball'] as const) {
      const p = payoffPlan(loans, d(0), s)!
      expect(p.months).toBe(9)
      expect(p.interest.toFixed(2)).toBe('123.98')
      expect(p.order).toEqual([{ name: 'B', month: 6 }, { name: 'A', month: 9 }])
    }
  })
  it('with 50 extra a month, avalanche (A, the 24% loan, first) beats snowball (B first)', () => {
    const av = payoffPlan(loans, d(50), 'avalanche')!
    const sn = payoffPlan(loans, d(50), 'snowball')!
    expect(av.months).toBe(7)
    expect(av.interest.toFixed(2)).toBe('97.41')
    expect(av.order).toEqual([{ name: 'B', month: 6 }, { name: 'A', month: 7 }])
    expect(sn.months).toBe(7)
    expect(sn.interest.toFixed(2)).toBe('102.01')
    expect(sn.order).toEqual([{ name: 'B', month: 4 }, { name: 'A', month: 7 }])
  })
})

describe('three loans: home, personal, car', () => {
  const loans = [debt('Home loan', 3000000, 8.5, 30000), debt('Personal loan', 400000, 14, 12000), debt('Car loan', 250000, 9.5, 8000)]
  it('as scheduled (no rolling): home 175 months, interest 22,36,977; personal 43 months; car 37 months', () => {
    const s = asScheduled(loans)!
    expect(s.months).toBe(175)
    expect(s.interest.toFixed(0)).toBe(String(2236977 + 109514 + 38344))
  })
  it('rolling freed EMIs alone ends the home loan in month 105 (interest 15,94,301)', () => {
    const p = payoffPlan(loans, d(0), 'avalanche')!
    expect(p.months).toBe(105)
    expect(p.interest.toFixed(0)).toBe('1594301')
    expect(p.order.map((o) => [o.name, o.month])).toEqual([['Car loan', 37], ['Personal loan', 40], ['Home loan', 105]])
  })
  it('with 5,000 extra: avalanche month 91 / 13,53,928; snowball month 92 / 13,66,158', () => {
    const av = payoffPlan(loans, d(5000), 'avalanche')!
    const sn = payoffPlan(loans, d(5000), 'snowball')!
    expect([av.months, av.interest.toFixed(0)]).toEqual([91, '1353928'])
    expect([sn.months, sn.interest.toFixed(0)]).toEqual([92, '1366158'])
    expect(av.order.map((o) => [o.name, o.month])).toEqual([['Personal loan', 28], ['Car loan', 31], ['Home loan', 91]])
    expect(sn.order.map((o) => [o.name, o.month])).toEqual([['Car loan', 21], ['Personal loan', 31], ['Home loan', 92]])
  })
  it('everything paid = money borrowed + interest (nothing lost or invented)', () => {
    // budget is spent in full every month until the last month, so total paid <= budget * months and >= principal
    const p = payoffPlan(loans, d(5000), 'avalanche')!
    const principal = loans.reduce((s, x) => s.plus(x.balance), d(0))
    const budgetMonths = d(50000 + 5000).times(p.months)
    expect(principal.plus(p.interest).lte(budgetMonths)).toBe(true)
    expect(principal.plus(p.interest).gt(budgetMonths.minus(55000))).toBe(true) // only the last month is under budget
  })
  it('avalanche never costs more interest than snowball; more extra never costs more', () => {
    for (const extra of [0, 1000, 5000, 20000]) {
      const av = payoffPlan(loans, d(extra), 'avalanche')!
      const sn = payoffPlan(loans, d(extra), 'snowball')!
      expect(av.interest.lte(sn.interest)).toBe(true)
    }
    expect(payoffPlan(loans, d(5000), 'avalanche')!.interest.lt(payoffPlan(loans, d(0), 'avalanche')!.interest)).toBe(true)
  })
})

describe('loans that never end', () => {
  it('names the loan whose EMI is below the monthly interest, and never loops', () => {
    // 1,00,000 at 12% = 1,000 a month interest; EMI 1,000 only pays the interest, EMI 900 is below it.
    expect(neverEnds([debt('Fine', 1000, 12, 600), debt('Stuck', 100000, 12, 900)])!.name).toBe('Stuck')
    expect(neverEnds([debt('Edge', 100000, 12, 1000)])!.name).toBe('Edge')
    expect(payoffPlan([debt('Stuck', 100000, 12, 900)], d(500), 'avalanche')).toBeNull()
    expect(asScheduled([debt('Stuck', 100000, 12, 900)])).toBeNull()
  })
  it('0% loans work', () => {
    const p = payoffPlan([debt('Z', 1000, 0, 300)], d(0), 'snowball')!
    expect(p.months).toBe(4)
    expect(p.interest.toFixed()).toBe('0')
  })
})

describe('runway', () => {
  // By hand: 7,00,000 of cash, 85,000 a month. 8 x 85,000 = 6,80,000; 20,000 left = 0.2353 of a month = 7.06 days -> 7.
  it('8 months and 7 days, rounded down', () => {
    const r = runway(d(700000), d(85000), d(0))
    expect(r.months).toBe(8)
    expect(r.days).toBe(7)
    expect(r.burn.toFixed()).toBe('85000')
  })
  it('income lowers the burn: 85,000 spend, 25,000 income -> burn 60,000 -> 11 months 20 days', () => {
    // 700000 / 60000 = 11.667 -> 11 months; 40,000 / 60,000 x 30 = 20 days
    const r = runway(d(700000), d(85000), d(25000))
    expect([r.months, r.days]).toEqual([11, 20])
  })
  it('never rounds up: 99,999 of cash at 100,000 a month is 0 months, 29 days', () => {
    const r = runway(d(99999), d(100000), d(0))
    expect([r.months, r.days]).toEqual([0, 29])
  })
  it('income that covers the spending is "never runs out"; no cash is 0 months', () => {
    expect(runway(d(1000), d(50000), d(50000)).months).toBeNull()
    expect(runway(d(1000), d(50000), d(60000)).months).toBeNull()
    const r = runway(d(0), d(50000), d(0))
    expect([r.months, r.days]).toEqual([0, 0])
  })
})

describe('part-paying a loan', () => {
  it('goes to the highest rate; a tie goes to the larger balance', () => {
    expect(partPayTarget([debt('A', 100, 9, 10), debt('B', 100, 14, 10), debt('C', 100, 11, 10)])!.name).toBe('B')
    expect(partPayTarget([debt('A', 100, 9, 10), debt('B', 500, 9, 10)])!.name).toBe('B')
    expect(partPayTarget([])).toBeNull()
  })
  // 1,000 at 12%, EMI 600: base 2 months, 14.10 interest. Part-pay 500 -> 500 left: month 1 interest 5.00, owed 505,
  // pays 505 and is done: 1 month, 5.00 interest. Saved 9.10, one month sooner.
  it('interest saved, by hand', () => {
    const r = partPay(debt('X', 1000, 12, 600), d(500))!
    expect(r.interestSaved.toFixed(2)).toBe('9.10')
    expect(r.monthsSaved).toBe(1)
    expect(r.clears).toBe(false)
  })
  it('paying the whole balance clears it and saves all its interest', () => {
    const r = partPay(debt('X', 1000, 12, 600), d(1000))!
    expect(r.clears).toBe(true)
    expect(r.interestSaved.toFixed(2)).toBe('14.10')
  })
  it('a loan that cannot end gives null', () => expect(partPay(debt('X', 100000, 12, 900), d(10))).toBeNull())
})
