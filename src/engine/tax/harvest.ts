import { D, type Dec } from '../decimal'
import { addMonths } from './capitalGains'
import { RULES_FY2026_27, type TaxRules } from './rules.FY2026-27'

/**
 * LTCG harvesting on listed shares and equity-fund units: how much long-term gain can still be booked this
 * year inside the Rs 1,25,000 exemption (Act s.198(2)(a)), and which holdings to sell for it. Selling and
 * buying back resets the cost, so the gain booked now is gain that never meets the 12.5% rate later.
 *
 * Rules, all primary, Act text (`docs/RESEARCH-BLOCKED-2026-11-06.md` section 5):
 *  - s.198(2)(a): 12.5% on equity LTCG "exceeding Rs 125000". s.196(1)(i): 20% on short-term, STT paid.
 *  - s.2(101): long-term means held MORE than 12 months for listed securities and equity-fund units.
 *  - s.90(7)-(8) grandfathering: bought before 1 Feb 2018, the cost is the higher of the real cost and the
 *    LOWER of (the 31 Jan 2018 value, the sale value). That needs the 31 Jan 2018 value as an input.
 *  - The Rs 1.25 lakh is per person per year across ALL shares and equity funds, and losses are set off
 *    first, so "already booked" is a NET figure and may be negative. Headroom = 1,25,000 - booked, never below 0.
 *
 * NOT modelled, and said so on screen: the s.198(3) reduction for people whose other income is below the
 * basic exemption limit (it can only lower the tax); surcharge (capped at 15% on these gains, so only the
 * high-income feel it); and any anti-wash-sale rule (none was read in the Act, so none is assumed).
 */
export interface Holding {
  name: string
  /** YYYY-MM-DD */
  buyDate: string
  /** Total cost, what you paid. */
  cost: Dec
  /** Total value if sold now. */
  value: Dec
  /** Value of the holding on 31 Jan 2018. Required when bought before 1 Feb 2018, else null. */
  fmv2018: Dec | null
}

export interface HoldingResult {
  name: string
  term: 'short' | 'long'
  /** The first day it counts as long-term. */
  longTermFrom: string
  costUsed: Dec
  grandfathered: boolean
  gain: Dec
  value: Dec
  /** Part of this holding's gain booked in the plan, and the sale value of the units that carries. */
  planGain: Dec
  planSell: Dec
}

export interface HarvestResult {
  holdings: HoldingResult[]
  exemption: Dec
  booked: Dec
  /** Exemption left this year: 1,25,000 less net long-term gains already booked, never below 0. */
  headroom: Dec
  /** Positive long-term gains across the holdings, if all were sold. */
  longTermAvailable: Dec
  /** What the plan books: the smaller of the headroom and the long-term gains available. */
  toBook: Dec
  /** 12.5% of `toBook`: tax you will not meet later on the gain you book now. */
  taxSaved: Dec
  /** The same with 4% cess. */
  taxSavedWithCess: Dec
  /** Gain still to book next year: available less what the plan books. */
  leftOver: Dec
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const validDate = (s: string) => {
  const m = DATE.exec(s)
  if (!m) return false
  const t = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)
  return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === s
}
/** The day after an ISO date. */
const nextDay = (s: string) => new Date(Date.parse(s + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)

export function harvestLtcg(
  holdings: Holding[],
  o: { sellDate: string; booked: Dec },
  r: TaxRules = RULES_FY2026_27,
): HarvestResult | { error: string } {
  const c = r.capitalGains
  if (holdings.length === 0) return { error: 'Add at least one holding' }
  if (!validDate(o.sellDate)) return { error: 'Enter the sale date' }
  if (o.sellDate < r.fyStart || o.sellDate > r.fyEnd) return { error: `These rules are for sales from ${r.fyStart} to ${r.fyEnd}` }

  const exemption = new D(c.equityLtcgExemption)
  const headroom = D.max(exemption.minus(o.booked), new D(0))
  const zero = new D(0)

  const base: HoldingResult[] = []
  for (const h of holdings) {
    const label = h.name || 'A holding'
    if (!validDate(h.buyDate)) return { error: `${label}: enter the buy date` }
    if (h.buyDate > o.sellDate) return { error: `${label}: bought after the sale date` }
    if (h.cost.isNegative() || h.value.isNegative()) return { error: `${label}: amounts cannot be negative` }
    const old = h.buyDate < c.equityGrandfatherBefore
    if (old && (h.fmv2018 === null || h.fmv2018.isNegative())) return { error: `${label}: bought before 1 Feb 2018, so enter its value on 31 Jan 2018` }
    // s.90(7)-(8): higher of the real cost and the lower of (31 Jan 2018 value, sale value).
    const costUsed = old ? D.max(h.cost, D.min(h.fmv2018!, h.value)) : h.cost
    const lt = addMonths(h.buyDate, c.listedLongTermAfterMonths)
    base.push({
      name: h.name || 'A holding',
      term: o.sellDate > lt ? 'long' : 'short',
      longTermFrom: nextDay(lt),
      costUsed,
      grandfathered: old,
      gain: h.value.minus(costUsed),
      value: h.value,
      planGain: zero,
      planSell: zero,
    })
  }

  // Plan: fill the headroom with long-term gains, in the order listed.
  let left = headroom
  const out = base.map((h) => {
    if (h.term !== 'long' || h.gain.lte(0) || left.lte(0)) return h
    const take = D.min(h.gain, left)
    left = left.minus(take)
    return { ...h, planGain: take, planSell: h.value.times(take).div(h.gain) }
  })

  const longTermAvailable = out.reduce((a, h) => (h.term === 'long' && h.gain.gt(0) ? a.plus(h.gain) : a), zero)
  const toBook = out.reduce((a, h) => a.plus(h.planGain), zero)
  const taxSaved = toBook.times(c.ltcgPct).div(100)
  return {
    holdings: out,
    exemption,
    booked: o.booked,
    headroom,
    longTermAvailable,
    toBook,
    taxSaved,
    taxSavedWithCess: taxSaved.times(new D(1).plus(new D(r.cessPct).div(100))),
    leftOver: longTermAvailable.minus(toBook),
  }
}
