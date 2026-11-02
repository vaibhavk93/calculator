import { D, type Dec } from '../decimal'
import { RULES_FY2026_27, type TaxRules } from './rules.FY2026-27'

export interface AdvanceInput {
  /** Total tax for the year, after rebate, with surcharge and cess. */
  tax: Dec
  /** TDS / TCS that will be deducted during the year. */
  tds: Dec
  /** Paid on or before each due date (not cumulative): Jun, Sep, Dec, Mar. */
  paid: [Dec, Dec, Dec, Dec]
  /** Declares income under s.58 presumptive taxation: one instalment by 15 March. */
  presumptive: boolean
  /** Resident aged 60+ with no business or professional income (s.403(3)): no advance tax. */
  seniorNoBusiness: boolean
  /** Months (part counts as whole) from 1 April after the year until the balance is paid. */
  monthsAfterYear: number
}

export interface InstalmentRow {
  due: string
  cumPct: Dec
  dueCum: Dec
  paidCum: Dec
  shortfall: Dec
  interest: Dec
}

export type AdvanceResult =
  | { required: false; net: Dec; reason: 'senior' | 'below' }
  | { required: true; net: Dec; rows: InstalmentRow[]; interest425: Dec; shortfall424: Dec; interest424: Dec; totalInterest: Dec }

export function advanceTax(a: AdvanceInput, r: TaxRules = RULES_FY2026_27): AdvanceResult | null {
  if (a.tax.isNegative() || a.tds.isNegative() || a.paid.some((p) => p.isNegative())) return null
  if (!Number.isInteger(a.monthsAfterYear) || a.monthsAfterYear < 0) return null
  const zero = new D(0)
  const net = D.max(0, a.tax.minus(a.tds))
  if (a.seniorNoBusiness) return { required: false, net, reason: 'senior' }
  if (net.lt(r.advanceTax.minTax)) return { required: false, net, reason: 'below' }

  const inst = r.advanceTax.instalments
  let paidCum = zero
  const rows: InstalmentRow[] = inst.map((x, k) => {
    paidCum = paidCum.plus(a.paid[k]!)
    const last = k === inst.length - 1
    // s.408(2), s.425(3): presumptive assessees owe nothing before 15 March, then 1% on the shortfall.
    const cumPct = new D(a.presumptive && !last ? 0 : x.cumPct)
    const dueCum = net.times(cumPct).div(100)
    const shortfall = D.max(0, dueCum.minus(paidCum))
    // s.425(2): no interest for June / September if 12% / 36% was paid by then.
    const safe = x.safeHarbourPct !== null && paidCum.gte(net.times(x.safeHarbourPct).div(100))
    const interest = safe ? zero : shortfall.times(x.interestPct).div(100)
    return { due: x.due, cumPct, dueCum, paidCum, shortfall, interest }
  })
  const interest425 = rows.reduce((s, x) => s.plus(x.interest), zero)
  // s.424: if advance tax paid is below 90% of assessed tax, 1% a month on the shortfall.
  const below = paidCum.lt(net.times(r.advanceTax.sec424ThresholdPct).div(100))
  const shortfall424 = below ? net.minus(paidCum) : zero
  const interest424 = shortfall424.times(r.advanceTax.sec424MonthlyPct).div(100).times(a.monthsAfterYear)
  return { required: true, net, rows, interest425, shortfall424, interest424, totalInterest: interest425.plus(interest424) }
}
