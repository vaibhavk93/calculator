import { D, type Dec } from '../decimal'
import { schedule, sum, type Row } from './loan'

/**
 * Extra EMI / part-payment planner. The loan runs as the standard reducing-balance loan (same EMI, same monthly
 * interest = balance × rate ÷ 1200 as `schedule` in loan.ts), plus:
 *  - `monthlyExtra`: paid together with every EMI, from EMI 1;
 *  - `yearlyLump`: paid right AFTER every 12th EMI (end of each loan year), when a balance is still left.
 * The EMI is not lowered, so the loan ends sooner. Everything at full precision; with both extras 0 the rows are
 * exactly `schedule(p, rate, n)`.
 */

/** Below this many rupees a balance counts as paid off (same cut-off as loan.ts). */
const DUST = new D('0.000001')

export interface ExtraPlan {
  /** The standard schedule, no extras. */
  base: Row[]
  /** The schedule with the extras. A row with a yearly lump has the lump inside `payment` and `principal`. */
  rows: Row[]
  emi: Dec
  months: number
  monthsSaved: number
  interest: Dec
  interestSaved: Dec
  /** Everything paid above the EMIs: monthly extras plus lumps. */
  extraPaid: Dec
  /** Total paid with the extras (EMIs + extras), and without. */
  totalPaid: Dec
  baseTotalPaid: Dec
}

/** Null when the inputs are not allowed (a negative extra, or n < 1). Rate 0 is fine. */
export function extraEmiPlan(p: Dec, annualPct: Dec, n: number, monthlyExtra: Dec, yearlyLump: Dec): ExtraPlan | null {
  if (n < 1 || monthlyExtra.isNegative() || yearlyLump.isNegative()) return null
  const base = schedule(p, annualPct, n)
  const pay = base[0]!.payment
  const r = annualPct.div(1200)
  const rows: Row[] = []
  let bal = p
  let extraPaid = new D(0)
  for (let m = 1; bal.gt(DUST); m++) {
    const interest = bal.times(r)
    // The EMI plus the monthly extra; the last month only pays what is left. Same closing test as `amortise`.
    const due = pay.plus(monthlyExtra)
    const closes = bal.plus(interest).minus(due).lt(DUST)
    let principal = closes ? bal : due.minus(interest)
    let payment = principal.plus(interest)
    bal = closes ? new D(0) : bal.minus(principal)
    if (payment.minus(pay).gt(DUST)) extraPaid = extraPaid.plus(payment.minus(pay))
    if (m % 12 === 0 && yearlyLump.gt(0) && bal.gt(DUST)) {
      const lump = D.min(yearlyLump, bal)
      bal = bal.minus(lump)
      principal = principal.plus(lump)
      payment = payment.plus(lump)
      extraPaid = extraPaid.plus(lump)
      if (bal.lt(DUST)) bal = new D(0)
    }
    rows.push({ month: m, payment, interest, principal, balance: bal })
  }
  const interest = sum(rows, 'interest')
  const baseInterest = sum(base, 'interest')
  return {
    base,
    rows,
    emi: pay,
    months: rows.length,
    monthsSaved: n - rows.length,
    interest,
    interestSaved: baseInterest.minus(interest),
    extraPaid,
    totalPaid: sum(rows, 'payment'),
    baseTotalPaid: sum(base, 'payment'),
  }
}
