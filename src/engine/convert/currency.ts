import { D, type Dec } from '../decimal'
import { CURRENCY_SNAPSHOT } from './currencySnapshot'

/** Converts via INR. `rate` is how much of `to` one unit of `from` buys. Null for an unknown currency. */
export function convertCurrency(amount: Dec, from: string, to: string, perInr: Record<string, string> = CURRENCY_SNAPSHOT.perInr): { result: Dec; rate: Dec } | null {
  const a = perInr[from]
  const b = perInr[to]
  if (!a || !b) return null
  const rate = new D(b).div(a)
  return { result: amount.times(rate), rate }
}
