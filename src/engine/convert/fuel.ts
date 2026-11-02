import { D, type Dec } from '../decimal'

/** Null if distance or mileage is zero or less, or the price is negative. */
export function fuelCost(distance: Dec, kmPerLitre: Dec, pricePerLitre: Dec): { litres: Dec; cost: Dec; perKm: Dec } | null {
  if (distance.lte(0) || kmPerLitre.lte(0) || pricePerLitre.isNegative()) return null
  const litres = distance.div(kmPerLitre)
  const cost = litres.times(pricePerLitre)
  return { litres, cost, perKm: cost.div(distance) }
}

export type EfficiencyUnit = 'kmpl' | 'mpgus' | 'mpguk' | 'l100'
// 1 mile = 1.609344 km (exact), 1 US gal = 3.785411784 L (exact), 1 UK gal = 4.54609 L (exact).
const KMPL_PER: Record<'mpgus' | 'mpguk', Dec> = {
  mpgus: new D('1.609344').div('3.785411784'),
  mpguk: new D('1.609344').div('4.54609'),
}

/** All four ways of writing the same efficiency. Null if the value is zero or less (l/100km of 0 is infinite km/l). */
export function fuelEfficiency(value: Dec, unit: EfficiencyUnit): Record<EfficiencyUnit, Dec> | null {
  if (value.lte(0)) return null
  const kmpl = unit === 'kmpl' ? value : unit === 'l100' ? new D(100).div(value) : value.times(KMPL_PER[unit])
  return { kmpl, mpgus: kmpl.div(KMPL_PER.mpgus), mpguk: kmpl.div(KMPL_PER.mpguk), l100: new D(100).div(kmpl) }
}
