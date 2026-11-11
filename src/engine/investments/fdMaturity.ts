import { D, type Dec } from '../decimal'
import { addDays, addMonths, daysBetween } from '../everyday/dates'
import { toYears, type TimeUnit } from '../duration'

/**
 * Fixed deposit: maturity date and value from a start date and a tenure in days, months or years.
 *
 * VALUE: the time used for the interest is the tenure as typed: years as they are, months ÷ 12, days ÷ 365 (the same
 * rule as the `fd` tool, a leap year is ignored). Compounded: A = P × (1 + r ÷ (100 n))^(n × t), n = periods a year
 * (monthly 12, quarterly 4, yearly 1); a part period compounds fractionally. "At maturity" is simple interest paid
 * once at the end: A = P × (1 + r × t ÷ 100).
 *
 * DATE: calendar-correct. Months and whole-month years use `addMonths` (31 Jan + 1 month = 28 Feb, month-end safe),
 * days use `addDays`, and a part month ("1.5 months", "0.7 years") becomes whole days, rounded half up, at 365 days a year.
 * The date does not change the value.
 */

export type FdComp = 'monthly' | 'quarterly' | 'yearly' | 'maturity'

/** Compounding periods a year; 0 means "at maturity" (simple interest). */
export const PERIODS_PER_YEAR: Record<FdComp, number> = { monthly: 12, quarterly: 4, yearly: 1, maturity: 0 }

const ONE = new D(1)

/** The day the deposit matures: `start` plus the tenure. Null when the tenure is in days and not a whole number of days. */
export function maturityDate(start: Date, n: Dec, unit: TimeUnit): Date | null {
  if (unit === 'days') return n.isInteger() ? addDays(start, n.toNumber()) : null
  const months = unit === 'years' ? n.times(12) : n
  if (months.isInteger()) return addMonths(start, months.toNumber())
  // a part month: whole days at 365 a year, half up
  const days = toYears(n, unit).times(365).toDecimalPlaces(0, D.ROUND_HALF_UP)
  return addDays(start, days.toNumber())
}

export interface FdResult {
  /** Tenure in years as used for the interest. */
  years: Dec
  amount: Dec
  interest: Dec
  maturity: Date
  /** Calendar days from the start date to the maturity date. */
  days: number
  /** The yearly rate that, compounded once a year, gives the same maturity: (A ÷ P)^(1 ÷ t) − 1, in percent. */
  effectivePct: Dec
  /** True when the tenure ends part way through a compounding period (odd days, 7 months compounded quarterly). */
  partPeriod: boolean
}

/** Value at `years` for any compounding. */
export function fdValue(principal: Dec, ratePct: Dec, years: Dec, comp: FdComp): Dec {
  const n = PERIODS_PER_YEAR[comp]
  if (n === 0) return principal.times(ONE.plus(ratePct.times(years).div(100)))
  return principal.times(ONE.plus(ratePct.div(100).div(n)).pow(years.times(n)))
}

/**
 * Null when the inputs are not allowed: principal or tenure not above 0, a rate outside 0 to 100, a tenure of more than
 * 50 years, or a tenure in days that is not a whole number.
 */
export function fdMaturity(principal: Dec, ratePct: Dec, tenure: Dec, unit: TimeUnit, start: Date, comp: FdComp): FdResult | null {
  if (principal.lte(0) || tenure.lte(0) || ratePct.isNegative() || ratePct.gt(100)) return null
  const years = toYears(tenure, unit)
  if (years.gt(50)) return null
  const maturity = maturityDate(start, tenure, unit)
  if (!maturity) return null
  const amount = fdValue(principal, ratePct, years, comp)
  const n = PERIODS_PER_YEAR[comp]
  return {
    years,
    amount,
    interest: amount.minus(principal),
    maturity,
    days: daysBetween(start, maturity),
    effectivePct: amount.div(principal).pow(ONE.div(years)).minus(1).times(100),
    partPeriod: n > 0 && !years.times(n).toDecimalPlaces(9).isInteger(),
  }
}
