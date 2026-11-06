import { D, type Dec } from '../decimal'
import { RULES_FY2026_27, type TaxRules } from '../tax/rules.FY2026-27'
import { DICGC } from './rates'
import { fd } from './invest'

/**
 * FD ladder: several fixed deposits, usually of staggered length, usually at more than one bank.
 * Shows what each rung grows to and the two things a ladder across banks is built around:
 *  - DICGC cover: Rs 5,00,000 per depositor per bank, principal and interest together (`rates.ts` DICGC).
 *  - TDS: Act s.393(1) Table Sl.5(ii), the bank deducts once a bank's yearly interest passes Rs 50,000
 *    (Rs 1,00,000 for a senior citizen), at 10% (`rules.tdsBankInterest`). The no-PAN rate is NOT modelled.
 *
 * ASSUMPTIONS, flagged on screen: all rungs at one bank name are one depositor in one capacity (joint
 * accounts insure separately, so this can overstate the risk); a bank is told apart only by its name
 * (case and spaces ignored); co-operative banks follow the same two limits here; the "yearly interest" is
 * the interest earned in the first year of each rung, a typical year, not a calendar-year tally.
 */
export interface Rung {
  bank: string
  principal: Dec
  ratePct: Dec
  /** Fractions allowed (1.5). */
  years: Dec
}

export interface RungResult extends Rung {
  maturity: Dec
  interest: Dec
  /** Interest earned in the first year, or in the whole term if shorter. */
  firstYearInterest: Dec
}

export interface BankResult {
  bank: string
  rungs: number
  principal: Dec
  /** Principal plus all interest at the end of every rung's term. */
  atMaturity: Dec
  /** The part of `atMaturity` DICGC would cover: at most the cover. */
  insured: Dec
  /** `atMaturity` above the cover. */
  notInsured: Dec
  /** Principal alone is already above the cover. */
  principalOver: boolean
  firstYearInterest: Dec
  /** Yearly interest is above the TDS threshold, so the bank deducts tax. */
  tdsApplies: boolean
}

export interface LadderResult {
  rungs: RungResult[]
  banks: BankResult[]
  principal: Dec
  atMaturity: Dec
  interest: Dec
  /** Rates averaged, weighted by principal. A plain average, not an exact-return figure. */
  blendedPct: Dec
  cover: Dec
  tdsThreshold: Dec
}

const key = (b: string) => b.trim().replace(/\s+/g, ' ').toLowerCase()

export function fdLadder(
  rungs: Rung[],
  o: { senior: boolean; perYear: number },
  r: TaxRules = RULES_FY2026_27,
): LadderResult | null {
  if (rungs.length === 0 || !Number.isInteger(o.perYear) || o.perYear < 1) return null
  for (const g of rungs) if (g.principal.lte(0) || g.ratePct.isNegative() || g.years.lte(0)) return null

  const cover = new D(DICGC.cover)
  const tdsThreshold = new D(o.senior ? r.tdsBankInterest.thresholdSenior : r.tdsBankInterest.thresholdOther)
  const one = new D(1)

  const results: RungResult[] = rungs.map((g) => {
    const maturity = fd(g.principal, g.ratePct, g.years, o.perYear)
    const first = fd(g.principal, g.ratePct, D.min(g.years, one), o.perYear)
    return { ...g, maturity, interest: maturity.minus(g.principal), firstYearInterest: first.minus(g.principal) }
  })

  const order: string[] = []
  const byBank = new Map<string, RungResult[]>()
  for (const g of results) {
    const k = key(g.bank)
    if (!byBank.has(k)) { byBank.set(k, []); order.push(k) }
    byBank.get(k)!.push(g)
  }
  const sum = (xs: Dec[]) => xs.reduce((a, b) => a.plus(b), new D(0))
  const banks: BankResult[] = order.map((k) => {
    const g = byBank.get(k)!
    const principal = sum(g.map((x) => x.principal))
    const atMaturity = sum(g.map((x) => x.maturity))
    const first = sum(g.map((x) => x.firstYearInterest))
    return {
      bank: g[0]!.bank.trim() || 'Bank',
      rungs: g.length,
      principal,
      atMaturity,
      insured: D.min(atMaturity, cover),
      notInsured: D.max(atMaturity.minus(cover), new D(0)),
      principalOver: principal.gt(cover),
      firstYearInterest: first,
      tdsApplies: first.gt(tdsThreshold),
    }
  })

  const principal = sum(results.map((x) => x.principal))
  const atMaturity = sum(results.map((x) => x.maturity))
  // Blended yearly rate: principal-weighted average of the rung rates (a plain, checkable number).
  const blendedPct = sum(results.map((x) => x.principal.times(x.ratePct))).div(principal)
  return { rungs: results, banks, principal, atMaturity, interest: atMaturity.minus(principal), blendedPct, cover, tdsThreshold }
}
