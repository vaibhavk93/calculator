import { D, type Dec } from '../decimal'
import { RULES_FY2026_27, type TaxRules } from './rules.FY2026-27'

export interface GratuityInput {
  /** Covered: last drawn monthly basic + DA. Not covered: average monthly salary of the last 10 months. */
  wage: Dec
  years: number
  /** Months beyond the whole years, 0-11. */
  months: number
  /** Employer is covered by the gratuity law (Payment of Gratuity Act / Code on Social Security). */
  covered: boolean
  /** What the employer actually pays; null to use the formula. */
  received: Dec | null
}

export interface GratuityResult {
  countedYears: number
  formula: Dec
  /** Covered: formula capped at the ceiling. Not covered: what was received (or the formula). */
  payable: Dec
  exempt: Dec
  taxable: Dec
}

export function gratuity(g: GratuityInput, r: TaxRules = RULES_FY2026_27): GratuityResult | null {
  const k = r.gratuity
  if (g.wage.isNegative() || !Number.isInteger(g.years) || !Number.isInteger(g.months)) return null
  if (g.years < 0 || g.months < 0 || g.months > 11 || g.received?.isNegative()) return null
  // Covered: a part year over six months counts as a year (PoGA s.4(2)). Not covered: completed years only.
  const countedYears = g.covered && g.months > k.roundUpAfterMonths ? g.years + 1 : g.years
  const perYear = g.covered ? g.wage.times(k.coveredDays).div(k.coveredDivisor) : g.wage.times(k.notCoveredFraction)
  const formula = perYear.times(countedYears)
  const ceiling = new D(k.ceiling)
  const payable = g.covered ? D.min(formula, ceiling) : (g.received ?? formula)
  const received = g.received ?? payable
  // s.19 Table Sl.5: received, limited to the s.4(2)-(3) amount. Sl.6: least of received, notified limit, formula.
  const exempt = g.covered ? D.min(received, payable) : D.min(received, new D(k.exemptLimit), formula)
  return { countedYears, formula, payable, exempt, taxable: received.minus(exempt) }
}
