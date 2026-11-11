import { D, type Dec } from '../decimal'
import { GOLD } from './gstRates'

/**
 * A gold jewellery bill. GST is 3% of the WHOLE transaction value: gold + making + stones, whether or not the
 * making charge is shown separately (CBEC jewellery FAQ Q7; see `gstRates.ts` GOLD). Every line is rounded to the
 * paisa, as a printed bill is, and the total is the sum of the printed lines.
 */
export type Making = { kind: 'percent'; value: Dec } | { kind: 'perGram'; value: Dec } | { kind: 'flat'; value: Dec }

export interface GoldBillInput {
  grams: Dec
  karat: number
  /** 24K rate per gram. */
  rate24: Dec
  /** The shop's own rate per gram for this purity, if you have it: used instead of rate24 x karat / 24. */
  rateForPurity: Dec | null
  making: Making
  /** Stones and any other charge for the piece, before GST. */
  stones: Dec
  /** Other state: IGST instead of CGST + SGST. */
  interState: boolean
}

export interface GoldBill {
  ratePerGram: Dec
  metal: Dec
  making: Dec
  stones: Dec
  /** Gold + making + stones: what GST is charged on. */
  taxable: Dec
  gstPct: Dec
  cgst: Dec | null
  sgst: Dec | null
  igst: Dec | null
  gst: Dec
  total: Dec
  /** Extra GST if a shop bills 5% on the making charge of a ready piece instead of 3% on the whole bill. */
  extraIfFivePctOnMaking: Dec
}

const paisa = (x: Dec) => x.toDecimalPlaces(2, D.ROUND_HALF_UP)

export function goldBill(i: GoldBillInput): GoldBill | null {
  if (!(GOLD.karats as readonly number[]).includes(i.karat)) return null
  if (i.grams.lte(0) || i.rate24.lte(0) || i.stones.isNegative() || i.making.value.isNegative()) return null
  if (i.rateForPurity && i.rateForPurity.lte(0)) return null
  if (i.making.kind === 'percent' && i.making.value.gt(100)) return null

  const ratePerGram = i.rateForPurity ?? i.rate24.times(i.karat).div(24)
  const metal = paisa(ratePerGram.times(i.grams))
  const making = paisa(
    i.making.kind === 'percent' ? metal.times(i.making.value).div(100) : i.making.kind === 'perGram' ? i.making.value.times(i.grams) : i.making.value,
  )
  const stones = paisa(i.stones)
  const taxable = metal.plus(making).plus(stones)

  const gstPct = new D(GOLD.ratePct)
  const half = (pctText: string) => paisa(taxable.times(pctText).div(100))
  const cgst = i.interState ? null : half(GOLD.cgstPct)
  const sgst = i.interState ? null : half(GOLD.sgstPct)
  const igst = i.interState ? half(GOLD.igstPct) : null
  const gst = igst ?? cgst!.plus(sgst!)
  return {
    ratePerGram,
    metal,
    making,
    stones,
    taxable,
    gstPct,
    cgst,
    sgst,
    igst,
    gst,
    total: taxable.plus(gst),
    extraIfFivePctOnMaking: paisa(making.times(new D(GOLD.jobWorkPct).minus(GOLD.ratePct)).div(100)),
  }
}
