import { D, type Dec } from '../decimal'

/**
 * Splits `total` into shares that add up to it EXACTLY (largest-remainder method).
 * Rs 100 three ways is 33.34 + 33.33 + 33.33, never 99.99. `weights` is a list of weights, or a
 * whole number of equal parts. `decimals` is the smallest unit kept (2 = paise). The total is
 * rounded to `decimals` first. Extra units go to the largest remainders, ties to the first.
 * A negative total is split the same way on its size, then negated. Null if the weights are
 * unusable (none, negative, all zero) or `decimals` is not a whole number from 0 to 10.
 */
export function allocate(total: Dec, weights: Dec[] | number, decimals: number): Dec[] | null {
  const w = typeof weights === 'number' ? (Number.isInteger(weights) && weights >= 1 && weights <= 10000 ? Array.from({ length: weights }, () => new D(1)) : []) : weights
  if (w.length === 0 || w.some((x) => !x.isFinite() || x.isNegative()) || !total.isFinite()) return null
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 10) return null
  const sum = w.reduce((a, x) => a.plus(x), new D(0))
  if (sum.isZero()) return null

  const unit = new D(10).pow(-decimals)
  const units = total.abs().div(unit).toDecimalPlaces(0, D.ROUND_HALF_UP) // whole units to hand out
  const parts = w.map((x, i) => {
    const num = units.times(x)
    let q = num.div(sum).floor()
    let rem = num.minus(q.times(sum)) // exact; compared as a numerator over the same `sum`
    if (rem.isNegative()) { q = q.minus(1); rem = rem.plus(sum) } // division rounded up at the 40th digit
    return { i, q, rem }
  })
  let left = units.minus(parts.reduce((a, p) => a.plus(p.q), new D(0))).toNumber()
  // Stable sort: equal remainders keep their order, so ties go to the first.
  for (const p of [...parts].sort((a, b) => b.rem.cmp(a.rem))) {
    if (left <= 0) break
    p.q = p.q.plus(1)
    left--
  }
  const sign = total.isNegative() ? -1 : 1
  return parts.map((p) => p.q.times(unit).times(sign).plus(0)) // plus(0) turns -0 into 0
}
