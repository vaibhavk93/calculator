import { D, type Dec } from '../decimal'

/**
 * Product-metrics formulas (standard SaaS definitions). Percent inputs are typed percents (70 = 70%).
 *   CAC          = marketing spend / new customers
 *   LTV          = ARPU x gross margin / monthly churn        (churn as a fraction)
 *   CAC payback  = CAC / (ARPU x gross margin)                (months)
 *   Rule of 40   = growth % + profit margin %
 *   Burn multiple = net burn / net new ARR
 */

export interface CacLtv {
  cac: Dec
  /** null when churn is 0: customers never leave, so lifetime value has no end. */
  ltv: Dec | null
  lifetimeMonths: Dec | null
  /** null when LTV is undefined or CAC is 0. */
  ratio: Dec | null
}

/** null when there are no new customers (CAC would divide by zero). */
export function cacLtv(spend: Dec, newCustomers: Dec, arpu: Dec, marginPct: Dec, churnPct: Dec): CacLtv | null {
  if (newCustomers.lte(0)) return null
  const cac = spend.div(newCustomers)
  if (churnPct.lte(0)) return { cac, ltv: null, lifetimeMonths: null, ratio: null }
  const churn = churnPct.div(100)
  const ltv = arpu.times(marginPct.div(100)).div(churn)
  return { cac, ltv, lifetimeMonths: new D(1).div(churn), ratio: cac.isZero() ? null : ltv.div(cac) }
}

/** Months to earn back CAC from gross profit. null when a customer earns no gross profit. */
export function cacPayback(cac: Dec, arpu: Dec, marginPct: Dec): Dec | null {
  const monthlyProfit = arpu.times(marginPct.div(100))
  return monthlyProfit.lte(0) ? null : cac.div(monthlyProfit)
}

export const ruleOf40 = (growthPct: Dec, marginPct: Dec): Dec => growthPct.plus(marginPct)

/** null when net new ARR is zero or negative: burning money with no growth has no multiple. */
export function burnMultiple(netBurn: Dec, netNewArr: Dec): Dec | null {
  return netNewArr.lte(0) ? null : netBurn.div(netNewArr)
}

export type BurnBand = 'great' | 'good' | 'okay' | 'weak' | 'bad'

/** Commonly cited rules of thumb, not a standard: <1 great, 1-1.5 good, 1.5-2 okay, 2-3 weak, >3 bad. */
export function burnBand(multiple: Dec): BurnBand {
  if (multiple.lt(1)) return 'great'
  if (multiple.lt(1.5)) return 'good'
  if (multiple.lt(2)) return 'okay'
  if (multiple.lte(3)) return 'weak'
  return 'bad'
}
