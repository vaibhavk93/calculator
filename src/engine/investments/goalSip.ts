import { D, type Dec } from '../decimal'
import { ymd } from '../everyday/dates'
import { sipMonths, type MonthRow } from './invest'

/**
 * Goal SIP by date: the monthly SIP that reaches a target at a date.
 *
 * CONVENTION (the screen says the same): everything compounds MONTHLY at rate / 12. The SIP goes in at the START of
 * each month (like `sipMonths`), and money already saved also grows monthly: saved × (1 + rate/1200)^months.
 * With a yearly step-up the SIP is raised by that % at the start of every completed 12 months.
 *
 * OPEN QUESTION: the older `goalSipMonths` (invest.ts, the "SIP for a goal" tool) grows the already-saved money once
 * a year, (1 + rate/100)^(months/12), which at 12% is 12.00% a year against 12.68% here. Neither is "the" answer: it
 * depends on how the fund compounds. Not changed there silently; flagged on both screens.
 */

const ONE = new D(1)

/** Whole months from `from` to `to`, a part month counted as a full month (14 Nov to 20 Nov next year = 13). Null when `to` is not after `from`. */
export function monthsUntil(from: Date, to: Date): number | null {
  const x = ymd(from, to)
  if (!x || (x.years === 0 && x.months === 0 && x.days === 0)) return null
  return x.years * 12 + x.months + (x.days > 0 ? 1 : 0)
}

export interface GoalPlan {
  /** The SIP to start with. Zero when the saved money alone reaches the target. */
  sip: Dec
  /** The SIP in the last year (equals `sip` with no step-up). */
  lastSip: Dec
  months: number
  /** What the already-saved money grows to (monthly compounding). */
  savedGrown: Dec
  /** Target minus savedGrown, floored at 0: what the SIP has to build. */
  gap: Dec
  /** SIPs paid in all. */
  invested: Dec
  /** The SIP's own growth: a row every 12th month and one at the last month. Its last `value` equals `gap`. */
  rows: MonthRow[]
}

/** Null when months < 1 or an input is negative. */
export function goalSipByMonths(target: Dec, annualPct: Dec, months: number, existing: Dec, stepUpPct: Dec = new D(0)): GoalPlan | null {
  if (months < 1 || target.isNegative() || annualPct.isNegative() || existing.isNegative() || stepUpPct.isNegative()) return null
  const savedGrown = existing.times(ONE.plus(annualPct.div(1200)).pow(months))
  const gap = D.max(target.minus(savedGrown), new D(0))
  // The end value is linear in the first SIP, so run a SIP of 1 once and divide.
  const factor = sipMonths(ONE, annualPct, months, stepUpPct).at(-1)!.value
  const sip = gap.div(factor)
  const rows = sipMonths(sip, annualPct, months, stepUpPct)
  const stepYears = Math.floor((months - 1) / 12)
  return {
    sip,
    lastSip: sip.times(ONE.plus(stepUpPct.div(100)).pow(stepYears)),
    months,
    savedGrown,
    gap,
    invested: rows.at(-1)!.invested,
    rows,
  }
}
