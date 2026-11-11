import type { Dec } from '../decimal'

/**
 * Break-even: how many units you must sell before the fixed costs are paid.
 *   contribution per unit = price - variable cost per unit
 *   break-even units      = fixed costs / contribution per unit, rounded UP (you cannot sell part of a unit)
 *   break-even sales      = break-even units x price
 * Margin of safety (against a planned volume q): (q - break-even units) / q.
 * Standard textbook cost-volume-profit; no outside rule text is needed. Money is Decimal, never a JS number.
 */
export interface BreakEven {
  contribution: Dec
  /** Contribution as a share of the price, in percent. */
  contributionPct: Dec
  /** Fixed / contribution, before rounding. */
  exactUnits: Dec
  /** Rounded up to a whole unit. */
  units: Dec
  /** units x price. */
  revenue: Dec
  planned: PlannedVolume | null
}

export interface PlannedVolume {
  units: Dec
  /** Profit at the planned volume; negative is a loss. */
  profit: Dec
  /** Planned units above break-even (negative when below). */
  safetyUnits: Dec
  /** (planned - break-even) / planned, in percent; negative when below break-even. */
  safetyPct: Dec
}

/** Profit (or loss, negative) when `units` are sold. */
export const profitAt = (fixed: Dec, price: Dec, variable: Dec, units: Dec): Dec => units.times(price.minus(variable)).minus(fixed)

/**
 * Null when there is no break-even: fixed costs not above zero, a price not above zero, a negative variable cost,
 * a price that does not exceed the variable cost (every unit loses money), or a planned volume not above zero.
 */
export function breakEven(fixed: Dec, price: Dec, variable: Dec, planned: Dec | null = null): BreakEven | null {
  if (fixed.lte(0) || price.lte(0) || variable.isNegative() || price.lte(variable)) return null
  if (planned !== null && planned.lte(0)) return null
  const contribution = price.minus(variable)
  const exactUnits = fixed.div(contribution)
  const units = exactUnits.ceil()
  return {
    contribution,
    contributionPct: contribution.div(price).times(100),
    exactUnits,
    units,
    revenue: units.times(price),
    planned:
      planned === null
        ? null
        : { units: planned, profit: profitAt(fixed, price, variable, planned), safetyUnits: planned.minus(units), safetyPct: planned.minus(units).div(planned).times(100) },
  }
}

