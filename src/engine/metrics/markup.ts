import { D, type Dec } from '../decimal'

/**
 * Markup and margin: two different percentages of the same profit, never to be mixed up.
 *   markup % = profit / COST x 100
 *   margin % = profit / SELLING PRICE x 100
 * So margin = markup / (1 + markup) and markup = margin / (1 - margin).
 */
export interface Markup {
  cost: Dec
  price: Dec
  profit: Dec
  markupPct: Dec
  marginPct: Dec
}

const from = (cost: Dec, price: Dec): Markup => {
  const profit = price.minus(cost)
  return { cost, price, profit, markupPct: profit.div(cost).times(100), marginPct: profit.div(price).times(100) }
}

/** Cost must be above zero. Selling price must be above zero. */
export function fromPrice(cost: Dec, price: Dec): Markup | null {
  return cost.gt(0) && price.gt(0) ? from(cost, price) : null
}

/** Price = cost x (1 + markup %). A markup of -100% or less would make the price zero or negative: null. */
export function fromMarkup(cost: Dec, markupPct: Dec): Markup | null {
  const price = cost.times(new D(1).plus(markupPct.div(100)))
  return cost.gt(0) && price.gt(0) ? from(cost, price) : null
}

/** Price = cost / (1 - margin %). A margin of 100% or more cannot be reached from a positive cost: null. */
export function fromMargin(cost: Dec, marginPct: Dec): Markup | null {
  const keep = new D(1).minus(marginPct.div(100))
  return cost.gt(0) && keep.gt(0) ? from(cost, cost.div(keep)) : null
}
