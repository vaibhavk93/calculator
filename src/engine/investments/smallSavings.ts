import { D, type Dec } from '../decimal'
import type { YearRow } from './invest'
import { KVP, MIS, NSC, SCSS, SSY } from './rates'

/**
 * The India Post / National Savings schemes. Rates and limits live in `rates.ts` with their sources; every
 * function here takes the rate as an argument (it is reset every quarter) and returns null for input the scheme
 * does not allow, so the screen can say why in plain words.
 */
const ONE = new D(1)
const pct = (r: Dec) => r.div(100)

/**
 * Sukanya Samriddhi. The yearly deposit goes in by 5 April and earns the whole year (interest is on the month's
 * lowest balance between the 5th and month end, credited at the financial year's end). Deposits run for
 * `depositYears` (15), then the balance keeps earning until the account matures at `termYears` (21) from opening.
 * ASSUMPTION: one deposit a year, and the rate stays what you enter for all 21 years.
 */
export function ssy(yearly: Dec, ratePct: Dec, depositYears = SSY.depositYears, termYears = SSY.termYears): YearRow[] | null {
  if (yearly.lt(SSY.minYearly) || yearly.gt(SSY.maxYearly) || ratePct.isNegative()) return null
  let bal = new D(0)
  const out: YearRow[] = []
  for (let y = 1; y <= termYears; y++) {
    if (y <= depositYears) bal = bal.plus(yearly)
    bal = bal.times(ONE.plus(pct(ratePct)))
    out.push({ year: y, invested: yearly.times(Math.min(y, depositYears)), value: bal })
  }
  return out
}

/** National Savings Certificate: yearly compounding, the interest "deemed to have been reinvested". 1,000 at 7.7% for 5 years is 1,449.03. */
export function nsc(amount: Dec, ratePct: Dec, years = NSC.years): YearRow[] | null {
  if (amount.lt(NSC.min) || !amount.mod(100).isZero() || ratePct.isNegative()) return null
  const out: YearRow[] = []
  for (let y = 1; y <= years; y++) out.push({ year: y, invested: amount, value: amount.times(ONE.plus(pct(ratePct)).pow(y)) })
  return out
}

export interface PayoutPlan {
  /** What is paid each period (a quarter for SCSS, a month for MIS). */
  perPeriod: Dec
  periodsPerYear: number
  yearly: Dec
  /** All the interest over the term. */
  total: Dec
  /** Principal back at the end. */
  principal: Dec
}

const payout = (p: Dec, ratePct: Dec, perYear: number, years: number): PayoutPlan => {
  const perPeriod = p.times(pct(ratePct)).div(perYear)
  return { perPeriod, periodsPerYear: perYear, yearly: perPeriod.times(perYear), total: perPeriod.times(perYear * years), principal: p }
}

/**
 * Senior Citizens Savings Scheme: quarterly interest = principal x rate / 4, paid out (unclaimed interest earns
 * nothing). Multiples of Rs 1,000, at most Rs 30 lakh. The first payout is for a part quarter when the account is
 * opened mid-quarter: NOT modelled, so the total is for full quarters.
 */
export function scss(principal: Dec, ratePct: Dec): PayoutPlan | null {
  if (principal.lt(SCSS.min) || principal.gt(SCSS.max) || !principal.mod(SCSS.multiple).isZero() || ratePct.isNegative()) return null
  return payout(principal, ratePct, 4, SCSS.years)
}

/** Monthly Income Scheme: monthly interest = principal x rate / 12. At most Rs 9 lakh alone, Rs 15 lakh jointly. */
export function mis(principal: Dec, ratePct: Dec, joint: boolean): PayoutPlan | null {
  const max = joint ? MIS.maxJoint : MIS.maxSingle
  if (principal.lt(MIS.min) || principal.gt(max) || ratePct.isNegative()) return null
  return payout(principal, ratePct, 12, MIS.years)
}

/**
 * Kisan Vikas Patra. The rule: the deposit "shall double on maturity", after `KVP.months` (115) months. The yearly
 * rate that doubling in that time works out to is shown as a cross-check: 7.5% over 115 months is 1.99985x, so the
 * official 7.5% and "doubles" agree to a fraction of a paisa per rupee.
 */
export function kvp(amount: Dec, months = KVP.months): { maturity: Dec; interest: Dec; impliedYearlyPct: Dec } | null {
  if (amount.lt(KVP.min) || months < 1) return null
  const implied = new D(2).pow(new D(12).div(months)).minus(1).times(100)
  return { maturity: amount.times(2), interest: amount, impliedYearlyPct: implied }
}

/**
 * Post Office Time Deposit, interest worked quarterly: (1 + r/4)^4 over a year.
 * `paidOut`: each year's interest is paid to you, the deposit stays the same. Otherwise the interest stays in and compounds.
 * ASSUMPTION: the rule text does not say which; see `TD` in `rates.ts`.
 */
export function timeDeposit(amount: Dec, ratePct: Dec, years: number, paidOut: boolean): { yearly: Dec; maturity: Dec; interest: Dec; rows: YearRow[] } | null {
  if (amount.lte(0) || ratePct.isNegative() || !Number.isInteger(years) || years < 1) return null
  const q = ONE.plus(pct(ratePct).div(4))
  const growth = q.pow(4)
  const rows: YearRow[] = []
  for (let y = 1; y <= years; y++) {
    const value = paidOut ? amount.plus(amount.times(growth.minus(1)).times(y)) : amount.times(growth.pow(y))
    rows.push({ year: y, invested: amount, value })
  }
  const last = rows[rows.length - 1]!
  return { yearly: amount.times(growth.minus(1)), maturity: last.value, interest: last.value.minus(amount), rows }
}
