import type { Dec } from '../decimal'

/** Null if the bill or tip is negative, or fewer than one person. `people` is a whole number. */
export function tip(bill: Dec, tipPercent: Dec, people: Dec): { tip: Dec; total: Dec; perPerson: Dec } | null {
  if (bill.isNegative() || tipPercent.isNegative() || people.lt(1) || !people.isInteger()) return null
  const t = bill.times(tipPercent).div(100)
  const total = bill.plus(t)
  return { tip: t, total, perPerson: total.div(people) }
}
