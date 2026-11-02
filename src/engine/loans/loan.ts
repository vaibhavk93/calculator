import { D, type Dec } from '../decimal'

/**
 * Reducing-balance loans. Everything is carried at full Decimal precision: no row is rounded.
 * Banks round the EMI to the rupee and adjust the last instalment, so a bank's own table can
 * differ from ours by a few rupees. The UI says so.
 */

export interface Row {
  month: number
  payment: Dec
  interest: Dec
  principal: Dec
  balance: Dec
}

/** Below this many rupees a balance counts as paid off (full-precision leftovers are ~1e-30). */
const DUST = new D('0.000001')
/** A loan that would not end within 100 years is treated as never ending. */
const MAX_MONTHS = 1200

const monthly = (annualPct: Dec) => annualPct.div(1200)

/** EMI = P·r·(1+r)^n / ((1+r)^n − 1), r = annual % / 12 / 100. With r = 0 it is P / n. n is whole months ≥ 1. */
export function emi(p: Dec, annualPct: Dec, n: number): Dec {
  const r = monthly(annualPct)
  if (r.isZero()) return p.div(n)
  const f = r.plus(1).pow(n)
  return p.times(r).times(f).div(f.minus(1))
}

/** Largest loan a given EMI can repay: P = EMI·((1+r)^n − 1) / (r·(1+r)^n). */
export function maxLoan(pay: Dec, annualPct: Dec, n: number): Dec {
  const r = monthly(annualPct)
  if (r.isZero()) return pay.times(n)
  const f = r.plus(1).pow(n)
  return pay.times(f.minus(1)).div(r.times(f))
}

/**
 * Pays `pay` a month until the balance is gone. With `lastMonth` set, that month clears whatever is left
 * (used for a fixed tenure, so the closing balance is exactly 0). Returns null if the payment never
 * covers the interest, so the loan would never end.
 */
export function amortise(p: Dec, annualPct: Dec, pay: Dec, firstMonth = 1, lastMonth?: number): Row[] | null {
  const r = monthly(annualPct)
  const rows: Row[] = []
  let bal = p
  for (let m = firstMonth; bal.gt(DUST); m++) {
    if (m - firstMonth >= MAX_MONTHS) return null
    const interest = bal.times(r)
    if (lastMonth === undefined && pay.lte(interest)) return null
    const closes = m === lastMonth || bal.plus(interest).minus(pay).lt(DUST)
    const principal = closes ? bal : pay.minus(interest)
    bal = closes ? new D(0) : bal.minus(principal)
    rows.push({ month: m, payment: principal.plus(interest), interest, principal, balance: bal })
  }
  return rows
}

/** The standard schedule: n equal EMIs, closing balance exactly 0. */
export function schedule(p: Dec, annualPct: Dec, n: number): Row[] {
  return amortise(p, annualPct, emi(p, annualPct, n), 1, n)!
}

export const sum = (rows: Row[], k: 'payment' | 'interest' | 'principal') => rows.reduce((s, x) => s.plus(x[k]), new D(0))

/** Rolls months into loan years: year, paid, interest, principal, closing balance. */
export function byYear(rows: Row[]): Row[] {
  const out: Row[] = []
  for (const x of rows) {
    const y = Math.ceil(x.month / 12)
    const last = out[out.length - 1]
    if (last && last.month === y) {
      last.payment = last.payment.plus(x.payment)
      last.interest = last.interest.plus(x.interest)
      last.principal = last.principal.plus(x.principal)
      last.balance = x.balance
    } else out.push({ ...x, month: y })
  }
  return out
}

// ---- C3 prepayment ----------------------------------------------------------

export type PrepayMode = 'reduceEmi' | 'reduceTenure'

export interface PrepayResult {
  base: Row[]
  rows: Row[]
  newEmi: Dec
  months: number
  interestSaved: Dec
  monthsSaved: number
}

/** A one-time prepayment right after EMI number `after` (1 ≤ after < n). Null if it clears the loan or the inputs are out of range. */
export function prepay(p: Dec, annualPct: Dec, n: number, amount: Dec, after: number, mode: PrepayMode): PrepayResult | 'clears' | null {
  if (after < 1 || after >= n) return null
  const base = schedule(p, annualPct, n)
  const left = base[after - 1]!.balance.minus(amount)
  if (left.lte(DUST)) return 'clears'
  const head = base.slice(0, after)
  const newEmi = mode === 'reduceEmi' ? emi(left, annualPct, n - after) : base[0]!.payment
  const tail = amortise(left, annualPct, newEmi, after + 1, mode === 'reduceEmi' ? n : undefined)!
  const rows = [...head, ...tail]
  return {
    base,
    rows,
    newEmi,
    months: rows.length,
    interestSaved: sum(base, 'interest').minus(sum(rows, 'interest')),
    monthsSaved: n - rows.length,
  }
}

// ---- C5 rate change -----------------------------------------------------------

export type RateChangeMode = 'keepEmi' | 'keepTenure'

/** The rate moves to `newPct` from EMI number `from` (2 ≤ from ≤ n). Null for 'never ends' (EMI no longer covers interest). */
export function rateChange(p: Dec, oldPct: Dec, n: number, newPct: Dec, from: number, mode: RateChangeMode) {
  const base = schedule(p, oldPct, n)
  const head = base.slice(0, from - 1)
  const bal = head.length ? head[head.length - 1]!.balance : p
  const newEmi = mode === 'keepTenure' ? emi(bal, newPct, n - from + 1) : base[0]!.payment
  const tail = amortise(bal, newPct, newEmi, from, mode === 'keepTenure' ? n : undefined)
  if (!tail) return null
  const rows = [...head, ...tail]
  return { base, rows, newEmi, months: rows.length, extraInterest: sum(rows, 'interest').minus(sum(base, 'interest')) }
}

// ---- cost of money --------------------------------------------------------------

/**
 * Monthly internal rate of return of `received` now against `payments` at months 1..k, by bisection.
 * Returned as an effective annual % : ((1+m)^12 − 1) × 100. Null if it cannot be bracketed.
 */
export function effectiveAnnualPct(received: Dec, payments: Dec[]): Dec | null {
  const npv = (m: Dec) => {
    const v = new D(1).div(m.plus(1))
    let df = new D(1)
    let s = received
    for (const x of payments) {
      df = df.times(v)
      s = s.minus(x.times(df))
    }
    return s
  }
  let lo = new D('-0.9')
  let hi = new D(1)
  if (npv(lo).gt(0) || npv(hi).lt(0)) return null
  for (let i = 0; i < 90; i++) {
    const mid = lo.plus(hi).div(2)
    if (npv(mid).lt(0)) lo = mid
    else hi = mid
  }
  return lo.plus(1).pow(12).minus(1).times(100)
}

// ---- C8 balance transfer --------------------------------------------------------

/** Same remaining tenure at a new rate, paying `fees` up front. Saving ignores the time value of money. */
export function balanceTransfer(bal: Dec, oldPct: Dec, months: number, newPct: Dec, fees: Dec) {
  const oldEmi = emi(bal, oldPct, months)
  const newEmi = emi(bal, newPct, months)
  const perMonth = oldEmi.minus(newEmi)
  const netSaving = perMonth.times(months).minus(fees)
  let breakeven: number | null = null
  if (perMonth.gt(0)) {
    const m = fees.div(perMonth).ceil().toNumber()
    breakeven = Math.max(m, 1) <= months ? Math.max(m, 1) : null
  }
  return { oldEmi, newEmi, perMonth, netSaving, breakeven }
}

// ---- C9 simple vs compound --------------------------------------------------------

/** SI = P·R·T/100; CI = P(1 + R/100/m)^(m·T) − P. */
export function simpleInterest(p: Dec, ratePct: Dec, years: Dec): Dec {
  return p.times(ratePct).times(years).div(100)
}
export function compoundInterest(p: Dec, ratePct: Dec, years: Dec, perYear: number): Dec {
  return p.times(ratePct.div(100).div(perYear).plus(1).pow(years.times(perYear))).minus(p)
}

// ---- C10 credit card EMI -----------------------------------------------------------

/** GST at `gstPct` on each month's interest and on the processing fee. Fee and its GST are paid at the start. */
export function cardEmi(p: Dec, annualPct: Dec, n: number, fee: Dec, gstPct: Dec) {
  const g = gstPct.div(100)
  const rows = schedule(p, annualPct, n)
  const interest = sum(rows, 'interest')
  const gstOnInterest = interest.times(g)
  const gstOnFee = fee.times(g)
  const total = p.plus(interest).plus(gstOnInterest).plus(fee).plus(gstOnFee)
  const firstMonthOut = rows[0]!.payment.plus(rows[0]!.interest.times(g))
  const effective = effectiveAnnualPct(
    p.minus(fee).minus(gstOnFee),
    rows.map((x) => x.payment.plus(x.interest.times(g))),
  )
  return { rows, emi: rows[0]!.payment, firstMonthOut, interest, gstOnInterest, gstOnFee, total, extra: total.minus(p), effective }
}
