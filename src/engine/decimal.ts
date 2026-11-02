import Decimal from 'decimal.js'

/**
 * One configured Decimal for the whole engine. A private clone, so nothing
 * else that imports decimal.js can change our precision underneath us.
 *
 * Why decimal.js at all: 0.1 + 0.2 must be exactly 0.3 in an app that tells
 * you what your EMI is.
 */
export const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -1000,
  toExpPos: 1000,
})

export type Dec = Decimal

/** Plain decimal string, never scientific notation, never "-0". */
export function toPlain(v: Dec, significantDigits = 20): string {
  if (v.isZero()) return '0'
  return v.toSignificantDigits(significantDigits).toFixed()
}
