import { D, type Dec } from '../decimal'
import { RULES_FY2026_27, type TaxRules } from './rules.FY2026-27'

/**
 * equity: listed shares / equity-fund units with STT paid (ss.196, 198).
 * debtFund: units of a fund with more than 65% in debt (s.76 "specified mutual fund").
 * property: land or building (s.197, with the s.197(3) indexation option).
 * gold: physical gold or jewellery (an "other" asset, 24 months).
 */
export type Asset = 'equity' | 'debtFund' | 'property' | 'gold'

export interface CgInput {
  asset: Asset
  /** YYYY-MM-DD */
  buyDate: string
  sellDate: string
  buyPrice: Dec
  sellPrice: Dec
  /** Brokerage, stamp duty on sale, agent fees: costs of the sale itself. */
  expenses: Dec
  /** Your slab rate, for gains taxed at slab rates. */
  slabPct: Dec
  /** Equity only: how much of the Rs 1.25 lakh LTCG exemption other sales this year already used. */
  exemptionUsed: Dec
}

export interface CgResult {
  term: 'short' | 'long'
  monthsHeld: number
  gain: Dec
  /** Gain after the equity LTCG exemption. */
  taxableGain: Dec
  ratePct: Dec
  /** 'slab' when taxed at the user's slab rate. */
  rateKind: 'flat' | 'slab'
  tax: Dec
  cess: Dec
  total: Dec
  /** Property bought before 23 Jul 2024: both computations, the lower one used. */
  indexed?: { ciiBuy: number; ciiSell: number; indexedCost: Dec; gain: Dec; tax: Dec; flatTax: Dec; chosen: 'indexed' | 'flat' }
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const parts = (s: string) => {
  const m = DATE.exec(s)
  return m ? { y: +m[1]!, m: +m[2]!, d: +m[3]! } : null
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Same day N months later, clamped to the month's last day. */
export function addMonths(date: string, n: number): string {
  const p = parts(date)!
  const total = p.y * 12 + (p.m - 1) + n
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return iso(y, m, Math.min(p.d, last))
}

/** Whole months from a to b. */
export function wholeMonths(a: string, b: string): number {
  let n = 0
  while (addMonths(a, n + 1) <= b) n++
  return n
}

/** FY start year of a date: Jan-Mar belong to the previous year's FY. */
const fyOf = (date: string) => {
  const p = parts(date)!
  return p.m >= 4 ? p.y : p.y - 1
}

export function capitalGains(i: CgInput, r: TaxRules = RULES_FY2026_27): CgResult | { error: string } {
  const c = r.capitalGains
  const b = parts(i.buyDate)
  const s = parts(i.sellDate)
  if (!b || !s || isNaN(Date.UTC(b.y, b.m - 1, b.d)) || isNaN(Date.UTC(s.y, s.m - 1, s.d))) return { error: 'Enter both dates' }
  if (i.sellDate < i.buyDate) return { error: 'The sale date is before the purchase date' }
  if (i.sellDate < r.fyStart || i.sellDate > r.fyEnd) return { error: `These rules are for sales from ${r.fyStart} to ${r.fyEnd}` }
  if (i.buyPrice.isNegative() || i.sellPrice.isNegative() || i.expenses.isNegative() || i.exemptionUsed.isNegative()) return { error: 'Amounts cannot be negative' }
  if (i.asset === 'equity' && i.buyDate < c.equityGrandfatherBefore)
    return { error: 'Not supported yet: shares bought before 1 Feb 2018 need the 31 Jan 2018 price rule' }
  if (i.asset === 'property' && i.buyDate < c.ciiBaseFrom)
    return { error: 'Not supported yet: property bought before 1 Apr 2001 needs its value on that date' }

  const months = i.asset === 'equity' ? c.listedLongTermAfterMonths : c.otherLongTermAfterMonths
  const alwaysShort = i.asset === 'debtFund' && i.buyDate >= c.debtFundAlwaysShortFrom
  const term = !alwaysShort && i.sellDate > addMonths(i.buyDate, months) ? 'long' : 'short'
  const gain = i.sellPrice.minus(i.buyPrice).minus(i.expenses)
  const cessOf = (t: Dec) => t.times(r.cessPct).div(100)
  const out = (taxableGain: Dec, ratePct: Dec, rateKind: 'flat' | 'slab', tax: Dec, indexed?: CgResult['indexed']): CgResult => ({
    term,
    monthsHeld: wholeMonths(i.buyDate, i.sellDate),
    gain,
    taxableGain,
    ratePct,
    rateKind,
    tax,
    cess: cessOf(tax),
    total: tax.plus(cessOf(tax)),
    indexed,
  })

  const zero = new D(0)
  if (gain.lte(0)) return out(zero, zero, 'flat', zero)

  if (term === 'short') {
    if (i.asset === 'equity') {
      const rate = new D(c.equityStcgPct)
      return out(gain, rate, 'flat', gain.times(rate).div(100))
    }
    return out(gain, i.slabPct, 'slab', gain.times(i.slabPct).div(100))
  }

  const lt = new D(c.ltcgPct)
  if (i.asset === 'equity') {
    const left = D.max(0, new D(c.equityLtcgExemption).minus(i.exemptionUsed))
    const taxable = D.max(0, gain.minus(left))
    return out(taxable, lt, 'flat', taxable.times(lt).div(100))
  }
  const flatTax = gain.times(lt).div(100)
  if (i.asset !== 'property' || i.buyDate >= c.propertyIndexationBoughtBefore) return out(gain, lt, 'flat', flatTax)

  // s.197(3): the excess of the 12.5% tax over 20%-with-indexation is ignored, so the lower one applies.
  const ciiBuy = c.cii[fyOf(i.buyDate)]
  const ciiSell = c.cii[fyOf(i.sellDate)]
  if (!ciiBuy || !ciiSell) return { error: 'No Cost Inflation Index for one of these years' }
  const indexedCost = i.buyPrice.times(ciiSell).div(ciiBuy)
  const indexedGain = D.max(0, i.sellPrice.minus(indexedCost).minus(i.expenses))
  const ip = new D(c.propertyIndexedPct)
  const indexedTax = indexedGain.times(ip).div(100)
  const chosen = indexedTax.lt(flatTax) ? 'indexed' : 'flat'
  const detail = { ciiBuy, ciiSell, indexedCost, gain: indexedGain, tax: indexedTax, flatTax, chosen } as const
  return chosen === 'indexed' ? out(indexedGain, ip, 'flat', indexedTax, detail) : out(gain, lt, 'flat', flatTax, detail)
}
