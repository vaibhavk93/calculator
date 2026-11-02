import { D, type Dec } from '../decimal'

export interface GstResult { base: Dec; gst: Dec; cgst: Dec | null; sgst: Dec | null; igst: Dec | null; total: Dec }

/**
 * mode 'add': `amount` is the price before GST. mode 'remove': `amount` already includes GST.
 * Same state (intra-state) splits GST into CGST + SGST halves; another state (inter-state) is all IGST.
 * Null if the amount is negative or the rate is negative.
 */
export function gst(amount: Dec, ratePercent: Dec, mode: 'add' | 'remove', interState: boolean): GstResult | null {
  if (amount.isNegative() || ratePercent.isNegative()) return null
  const factor = new D(1).plus(ratePercent.div(100))
  const base = mode === 'add' ? amount : amount.div(factor)
  const total = mode === 'add' ? amount.times(factor) : amount
  const tax = total.minus(base)
  return interState
    ? { base, gst: tax, cgst: null, sgst: null, igst: tax, total }
    : { base, gst: tax, cgst: tax.div(2), sgst: tax.div(2), igst: null, total }
}
