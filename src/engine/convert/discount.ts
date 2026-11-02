import { D, type Dec } from '../decimal'

export interface DiscountResult { final: Dec; saved: Dec; effectivePercent: Dec }

/**
 * Percent discounts apply one after another ("20% then 10%"), then the flat amount comes off.
 * Null if the price is zero or less, a percent is outside 0 to 100, or the flat amount is negative.
 * The final price can still be negative when the flat amount is bigger than the price: the caller decides what to say.
 */
export function discount(mrp: Dec, percents: Dec[], flat: Dec): DiscountResult | null {
  if (mrp.lte(0) || flat.isNegative() || percents.some((p) => p.isNegative() || p.gt(100))) return null
  let price = mrp
  for (const p of percents) price = price.times(new D(100).minus(p)).div(100)
  const final = price.minus(flat)
  return { final, saved: mrp.minus(final), effectivePercent: mrp.minus(final).div(mrp).times(100) }
}
