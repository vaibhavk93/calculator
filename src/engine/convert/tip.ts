import type { Dec } from '../decimal'
import { allocate } from './allocate'

/**
 * Null if the bill or tip is negative, or fewer than one person (or more than 1000). `people` is a whole number.
 * `shares` are what each person pays in whole paise and add up to `total` exactly; `perPerson` is the unrounded average.
 */
export function tip(bill: Dec, tipPercent: Dec, people: Dec): { tip: Dec; total: Dec; perPerson: Dec; shares: Dec[] } | null {
  if (bill.isNegative() || tipPercent.isNegative() || people.lt(1) || !people.isInteger() || people.gt(1000)) return null
  const t = bill.times(tipPercent).div(100)
  const total = bill.plus(t)
  return { tip: t, total, perPerson: total.div(people), shares: allocate(total, people.toNumber(), 2)! }
}
