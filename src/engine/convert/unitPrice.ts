import { D, type Dec } from '../decimal'

export type PriceUnit = 'g' | 'kg' | 'ml' | 'l' | 'pc'
export type Family = 'weight' | 'volume' | 'count'

/** How many standard units (kg, litre, piece) one of each unit is, and which family it belongs to. */
const UNITS: Record<PriceUnit, { family: Family; perStd: string }> = {
  g: { family: 'weight', perStd: '0.001' },
  kg: { family: 'weight', perStd: '1' },
  ml: { family: 'volume', perStd: '0.001' },
  l: { family: 'volume', perStd: '1' },
  pc: { family: 'count', perStd: '1' },
}
export const STANDARD_UNIT: Record<Family, string> = { weight: 'kg', volume: 'litre', count: 'piece' }

export interface UnitPriceRow { price: Dec; quantity: Dec; unit: PriceUnit }
export interface UnitPriceResult {
  family: Family
  /** Cost per kg, litre or piece, in the same order as the input rows. */
  perUnit: Dec[]
  cheapest: number
}

/** Null if the rows mix families (weight vs volume), a price is negative, or a quantity is zero or less. */
export function unitPrices(rows: UnitPriceRow[]): UnitPriceResult | null {
  if (rows.length === 0) return null
  const family = UNITS[rows[0]!.unit].family
  const perUnit: Dec[] = []
  for (const r of rows) {
    const u = UNITS[r.unit]
    if (u.family !== family || r.price.isNegative() || r.quantity.lte(0)) return null
    perUnit.push(r.price.div(r.quantity.times(new D(u.perStd))))
  }
  const cheapest = perUnit.reduce((best, v, i) => (v.lt(perUnit[best]!) ? i : best), 0)
  return { family, perUnit, cheapest }
}
