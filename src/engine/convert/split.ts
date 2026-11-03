import { D, type Dec } from '../decimal'
import { allocate } from './allocate'

/**
 * Splitting a bill unevenly. `weights` is one number per person, read by `mode`:
 *  percent: each person's percent of the bill, which must add to 100.
 *  shares:  parts (2 and 1 means two thirds and one third).
 *  exact:   each person's own amount of the bill, which must add to the bill.
 * The tip is added on top and shared the same way, so a person who ate more also tips more.
 * Shares add up to the total EXACTLY (to the paisa): `allocate`'s largest-remainder rounding.
 */
export type SplitMode = 'percent' | 'shares' | 'exact'

export type SplitResult =
  | { ok: true; tip: Dec; total: Dec; shares: Dec[] }
  /** 'invalid': a negative, no people, more than 1000, or everything zero. The others carry what the numbers added to. */
  | { ok: false; reason: 'invalid' | 'percent-sum' | 'exact-sum'; sum: Dec }

export function splitBill(bill: Dec, tipPercent: Dec, mode: SplitMode, weights: Dec[]): SplitResult {
  const zero = new D(0)
  if (bill.isNegative() || tipPercent.isNegative() || weights.length < 1 || weights.length > 1000 || weights.some((w) => w.isNegative())) return { ok: false, reason: 'invalid', sum: zero }
  const sum = weights.reduce((a, w) => a.plus(w), zero)
  if (sum.isZero()) return { ok: false, reason: 'invalid', sum }
  if (mode === 'percent' && !sum.eq(100)) return { ok: false, reason: 'percent-sum', sum }
  if (mode === 'exact' && !sum.eq(bill)) return { ok: false, reason: 'exact-sum', sum }
  const tip = bill.times(tipPercent).div(100)
  const total = bill.plus(tip)
  const shares = allocate(total, weights, 2)
  return shares ? { ok: true, tip, total, shares } : { ok: false, reason: 'invalid', sum }
}

/** One person paid the whole bill: everyone else owes them their share. `payer` is a 0-based index; null if it is out of range. */
export function settleUp(shares: Dec[], payer: number): { person: number; owes: Dec }[] | null {
  if (!Number.isInteger(payer) || payer < 0 || payer >= shares.length) return null
  return shares.flatMap((s, i) => (i !== payer && s.gt(0) ? [{ person: i, owes: s }] : []))
}
