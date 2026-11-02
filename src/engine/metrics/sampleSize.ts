/**
 * A/B test sample size. Statistics, not money, so plain numbers are fine here.
 * Two-sided test for two proportions, equal split:
 *   n = (z(1-a/2) x sqrt(2 x pbar x qbar) + z(power) x sqrt(p1 q1 + p2 q2))^2 / (p2 - p1)^2     per variant
 * This is the formula behind R's power.prop.test.
 */

// Acklam's rational approximation of the inverse normal CDF, relative error about 1e-9.
const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
const E = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]

/** z such that P(Z <= z) = p, for 0 < p < 1. null outside that range. */
export function normInv(p: number): number | null {
  if (!(p > 0 && p < 1)) return null
  const tail = (q: number) =>
    (((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q + C[5]!) /
    ((((E[0]! * q + E[1]!) * q + E[2]!) * q + E[3]!) * q + 1)
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)))
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)))
  const q = p - 0.5
  const r = q * q
  return (
    ((((((A[0]! * r + A[1]!) * r + A[2]!) * r + A[3]!) * r + A[4]!) * r + A[5]!) * q) /
    (((((B[0]! * r + B[1]!) * r + B[2]!) * r + B[3]!) * r + B[4]!) * r + 1)
  )
}

export type MdeType = 'absolute' | 'relative'

/**
 * Visitors needed in EACH variant to detect a rise from `baseline` (fraction, 0.2 = 20%) by `mde`
 * (a fraction too: absolute = percentage points, relative = share of the baseline).
 * `alpha` and `power` are fractions (0.05, 0.8). Returns the unrounded n and the variant's expected rate, or null if
 * the inputs make no sense (rate outside 0..1, no effect, alpha or power outside 0..1).
 */
export function sampleSize(baseline: number, mde: number, type: MdeType, alpha: number, power: number): { n: number; p2: number } | null {
  const p1 = baseline
  const p2 = type === 'absolute' ? p1 + mde : p1 * (1 + mde)
  const za = normInv(1 - alpha / 2)
  const zb = normInv(power)
  if (za === null || zb === null || !(p1 > 0 && p1 < 1) || !(p2 > 0 && p2 <= 1) || !(p2 > p1)) return null
  const pbar = (p1 + p2) / 2
  const n = (za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2
  return { n, p2 }
}
