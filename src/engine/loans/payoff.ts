import { D, type Dec } from '../decimal'
import { amortise, sum } from './loan'

/**
 * Several loans at once (C13) and the runway of a cash pile (C12). Pure maths, full Decimal precision.
 *
 * Payoff plan, the standard method: every month the whole budget (all EMIs plus any extra) is spent. Each loan
 * gets its own EMI first; whatever that leaves, including the EMIs of loans already cleared, goes to the first
 * loan still open in the strategy's order. Interest is charged monthly on the balance (rate ÷ 12), as in loan.ts.
 * A loan's last instalment is only what is left of it.
 */

export interface Debt {
  name: string
  balance: Dec
  /** Yearly interest, in percent. */
  ratePct: Dec
  /** Monthly instalment. */
  emi: Dec
}

export type Strategy = 'avalanche' | 'snowball'

export interface Plan {
  /** Months until the last loan is gone. */
  months: number
  interest: Dec
  /** Loans in the order they were cleared, with the month each one was cleared in. */
  order: { name: string; month: number }[]
}

const DUST = new D('0.000001')
const MAX_MONTHS = 1200

/** The first loan whose EMI does not cover one month's interest (it would never end on its own), or null. */
export function neverEnds(debts: Debt[]): Debt | null {
  return debts.find((x) => x.emi.lte(x.balance.times(x.ratePct).div(1200))) ?? null
}

/** Avalanche: highest rate first (smaller balance breaks a tie). Snowball: smallest balance first (higher rate breaks a tie). */
function priority(debts: Debt[], s: Strategy): number[] {
  const idx = debts.map((_, i) => i)
  const byRate = (a: number, b: number) => debts[b]!.ratePct.cmp(debts[a]!.ratePct) || debts[a]!.balance.cmp(debts[b]!.balance)
  const byBalance = (a: number, b: number) => debts[a]!.balance.cmp(debts[b]!.balance) || debts[b]!.ratePct.cmp(debts[a]!.ratePct)
  return idx.sort(s === 'avalanche' ? byRate : byBalance)
}

/** Plays the plan month by month. Null if some loan's EMI cannot cover its interest or it would run over 100 years. */
export function payoffPlan(debts: Debt[], extra: Dec, strategy: Strategy): Plan | null {
  if (neverEnds(debts)) return null
  const first = priority(debts, strategy)
  const bal = debts.map((x) => x.balance)
  const budget = debts.reduce((s, x) => s.plus(x.emi), extra)
  const order: Plan['order'] = []
  let interest = new D(0)
  let month = 0
  while (bal.some((b) => b.gt(DUST))) {
    if (++month > MAX_MONTHS) return null
    const owed = debts.map((x, i) => {
      if (bal[i]!.lte(DUST)) return new D(0)
      const int = bal[i]!.times(x.ratePct).div(1200)
      interest = interest.plus(int)
      return bal[i]!.plus(int)
    })
    // each loan's own EMI first (its last instalment is only what is left) ...
    const paid = owed.map((o, i) => D.min(o, debts[i]!.emi))
    let pool = paid.reduce((s, x) => s.minus(x), budget)
    // ... then the leftover to the first open loan in order, then the next
    for (const i of first) {
      const room = owed[i]!.minus(paid[i]!)
      if (room.gt(0) && pool.gt(0)) {
        const more = D.min(room, pool)
        paid[i] = paid[i]!.plus(more)
        pool = pool.minus(more)
      }
    }
    debts.forEach((x, i) => {
      if (owed[i]!.isZero()) return
      bal[i] = owed[i]!.minus(paid[i]!)
      if (bal[i]!.lte(DUST)) {
        bal[i] = new D(0)
        order.push({ name: x.name, month })
      }
    })
  }
  return { months: month, interest, order }
}

/** Each loan paid on its own with its own EMI, nothing rolled over: the plan you are on today. */
export function asScheduled(debts: Debt[]): { months: number; interest: Dec } | null {
  let months = 0
  let interest = new D(0)
  for (const x of debts) {
    const rows = amortise(x.balance, x.ratePct, x.emi)
    if (!rows) return null
    months = Math.max(months, rows.length)
    interest = interest.plus(sum(rows, 'interest'))
  }
  return { months, interest }
}

// ---- C12 Runway ----------------------------------------------------------------

export interface Runway {
  /** Money going out minus money coming in, per month. */
  burn: Dec
  /** Whole months the money lasts (rounded down), or null when income covers the spending, so it never runs out. */
  months: number | null
  /** Days left after those whole months, on a 30-day month. */
  days: number
}

/** cash ÷ monthly burn, months rounded down. A month is 30 days for the leftover days. */
export function runway(cash: Dec, spend: Dec, income: Dec): Runway {
  const burn = spend.minus(income)
  if (burn.lte(0)) return { burn, months: null, days: 0 }
  const whole = cash.div(burn).floor()
  const days = cash.minus(whole.times(burn)).div(burn).times(30).floor()
  return { burn, months: whole.toNumber(), days: days.toNumber() }
}

/** The loan to part-pay first: the highest rate (the larger balance breaks a tie). Null for no loans. */
export function partPayTarget(debts: Debt[]): Debt | null {
  return debts.reduce<Debt | null>((best, x) => (!best || x.ratePct.gt(best.ratePct) || (x.ratePct.eq(best.ratePct) && x.balance.gt(best.balance)) ? x : best), null)
}

/**
 * Part-paying `amount` into one loan and keeping its EMI the same (so it ends sooner).
 * `clears` is true when the amount covers the whole balance. Null if the loan never ends on its EMI.
 */
export function partPay(d: Debt, amount: Dec): { interestSaved: Dec; clears: boolean; monthsSaved: number } | null {
  const base = amortise(d.balance, d.ratePct, d.emi)
  if (!base) return null
  const left = d.balance.minus(amount)
  if (left.lte(DUST)) return { interestSaved: sum(base, 'interest'), clears: true, monthsSaved: base.length }
  const after = amortise(left, d.ratePct, d.emi)!
  return { interestSaved: sum(base, 'interest').minus(sum(after, 'interest')), clears: false, monthsSaved: base.length - after.length }
}
