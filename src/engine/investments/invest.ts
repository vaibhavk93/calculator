import { D, type Dec } from '../decimal'

/** One year-end snapshot: money put in so far, and what it is worth. */
export interface YearRow {
  year: number
  invested: Dec
  value: Dec
}

const ONE = new D(1)
const pct = (r: Dec) => r.div(100)

/**
 * SIP, payments at the START of each month (annuity-due), monthly rate = annual / 12 / 100.
 * `stepUp` raises the monthly amount by that % at the start of every new year (step-up SIP).
 * Simulated month by month, so the year-wise table and the closed form check each other in tests.
 */
export function sip(monthly: Dec, annualPct: Dec, years: number, stepUpPct: Dec = new D(0)): YearRow[] {
  const i = annualPct.div(1200)
  let amount = monthly
  let bal = new D(0)
  let invested = new D(0)
  const out: YearRow[] = []
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      bal = bal.plus(amount).times(ONE.plus(i))
      invested = invested.plus(amount)
    }
    out.push({ year: y, invested, value: bal })
    amount = amount.times(ONE.plus(pct(stepUpPct)))
  }
  return out
}

/** Closed form of a flat SIP: P × ((1+i)^n − 1) / i × (1+i). */
export function sipFutureValue(monthly: Dec, annualPct: Dec, months: number): Dec {
  const i = annualPct.div(1200)
  if (i.isZero()) return monthly.times(months)
  return monthly.times(ONE.plus(i).pow(months).minus(1)).div(i).times(ONE.plus(i))
}

/** Lumpsum, compounded yearly: A = P(1+r)^t. */
export function lumpsum(principal: Dec, annualPct: Dec, years: number): YearRow[] {
  const out: YearRow[] = []
  for (let y = 1; y <= years; y++) out.push({ year: y, invested: principal, value: principal.times(ONE.plus(pct(annualPct)).pow(y)) })
  return out
}

/**
 * Monthly SIP needed to reach `target`. The existing corpus grows as a lumpsum (yearly compounding).
 * Returns 0 when the existing corpus alone gets there, null when there are no months.
 */
export function goalSip(target: Dec, annualPct: Dec, years: number, existing: Dec): Dec | null {
  const months = Math.round(years * 12)
  if (months <= 0) return null
  const gap = target.minus(existing.times(ONE.plus(pct(annualPct)).pow(years)))
  if (gap.lte(0)) return new D(0)
  return gap.div(sipFutureValue(ONE, annualPct, months))
}

export interface SwpResult {
  /** Whole monthly withdrawals paid in full. null = the corpus never runs out. */
  months: number | null
  /** Balance at each year end (up to 100 years). */
  yearEnd: Dec[]
  totalWithdrawn: Dec
}

/**
 * SWP: each month the balance earns annual/12 %, then the withdrawal is taken (end of month).
 * Never runs out when the monthly interest covers the withdrawal. Simulates at most 100 years.
 */
export function swp(corpus: Dec, withdrawal: Dec, annualPct: Dec): SwpResult {
  const i = annualPct.div(1200)
  const never = corpus.times(i).gte(withdrawal)
  let bal = corpus
  let total = new D(0)
  const yearEnd: Dec[] = []
  for (let m = 1; m <= 1200; m++) {
    bal = bal.times(ONE.plus(i))
    if (bal.lt(withdrawal)) {
      total = total.plus(bal)
      yearEnd.push(new D(0))
      return { months: m - 1, yearEnd, totalWithdrawn: total }
    }
    bal = bal.minus(withdrawal)
    total = total.plus(withdrawal)
    if (m % 12 === 0) yearEnd.push(bal)
  }
  return { months: never ? null : 1200, yearEnd, totalWithdrawn: total }
}

/**
 * What the corpus grows to over `months` of saving at `annualPct` (monthly compounding, the same convention
 * swp() uses while withdrawing). With 0 months it is the corpus unchanged.
 */
export function growCorpus(corpus: Dec, annualPct: Dec, months: number): Dec {
  return corpus.times(ONE.plus(annualPct.div(1200)).pow(months))
}

/** FD: A = P(1 + r/n)^(n·t), n = compounding periods per year. */
export function fd(principal: Dec, annualPct: Dec, years: Dec, perYear: number): Dec {
  return principal.times(ONE.plus(pct(annualPct).div(perYear)).pow(years.times(perYear)))
}

/**
 * RD as Indian banks and India Post compute it: compounded quarterly, each monthly instalment
 * earns for the months it stays. Value after N months = Σ R(1+r/4)^(k/3), k = 1..N.
 */
export function rd(monthly: Dec, annualPct: Dec, months: number): Dec {
  const q = ONE.plus(pct(annualPct).div(4))
  let sum = new D(0)
  for (let k = 1; k <= months; k++) sum = sum.plus(monthly.times(q.pow(new D(k).div(3))))
  return sum
}

/** PPF: the yearly deposit goes in at the start of the year, interest credited at year end. */
export function ppf(yearly: Dec, annualPct: Dec, years: number): YearRow[] {
  let bal = new D(0)
  const out: YearRow[] = []
  for (let y = 1; y <= years; y++) {
    bal = bal.plus(yearly).times(ONE.plus(pct(annualPct)))
    out.push({ year: y, invested: yearly.times(y), value: bal })
  }
  return out
}

/**
 * EPF. Monthly: employee share = basic × employee%; employer's EPF share = basic × employer% minus the
 * pension (EPS) part, which is epsShare% of basic capped at the wage ceiling. Interest is worked out on
 * the running monthly balance at rate/12 and credited once a year. Salary grows once a year.
 */
export function epf(o: {
  basic: Dec
  employeePct: Dec
  employerPct: Dec
  growthPct: Dec
  years: number
  ratePct: Dec
  epsSharePct: Dec
  wageCeiling: Dec
}): YearRow[] {
  const mi = o.ratePct.div(1200)
  let basic = o.basic
  let bal = new D(0)
  let invested = new D(0)
  const out: YearRow[] = []
  for (let y = 1; y <= o.years; y++) {
    const eps = D.min(basic, o.wageCeiling).times(pct(o.epsSharePct))
    const employer = D.max(0, basic.times(pct(o.employerPct)).minus(eps))
    const monthly = basic.times(pct(o.employeePct)).plus(employer)
    let interest = new D(0)
    for (let m = 0; m < 12; m++) {
      bal = bal.plus(monthly)
      invested = invested.plus(monthly)
      interest = interest.plus(bal.times(mi))
    }
    bal = bal.plus(interest)
    out.push({ year: y, invested, value: bal })
    basic = basic.times(ONE.plus(pct(o.growthPct)))
  }
  return out
}

/** CAGR % = ((end / start)^(1/years) − 1) × 100. null when undefined. */
export function cagr(start: Dec, end: Dec, years: Dec): Dec | null {
  if (start.lte(0) || end.lt(0) || years.lte(0)) return null
  return end.div(start).pow(ONE.div(years)).minus(1).times(100)
}

export type XirrResult = { rate: Dec } | { error: 'too-few' | 'no-sign-change' | 'no-solution' }

/**
 * XIRR as Excel defines it: Σ cᵢ / (1+r)^((dᵢ − d₀)/365) = 0, d₀ = the earliest date.
 * Newton's method from 10%, then bisection if Newton leaves the domain or does not settle.
 * Returns the rate as a fraction (0.3734 = 37.34%).
 */
export function xirr(flows: { date: Date; amount: Dec }[]): XirrResult {
  if (flows.length < 2) return { error: 'too-few' }
  if (!flows.some((f) => f.amount.lt(0)) || !flows.some((f) => f.amount.gt(0))) return { error: 'no-sign-change' }
  const d0 = Math.min(...flows.map((f) => f.date.getTime()))
  const ts = flows.map((f) => ({ t: new D(f.date.getTime() - d0).div(86_400_000 * 365), c: f.amount }))
  const npv = (r: Dec) => ts.reduce((s, { t, c }) => s.plus(c.div(ONE.plus(r).pow(t))), new D(0))
  const dnpv = (r: Dec) => ts.reduce((s, { t, c }) => s.minus(c.times(t).div(ONE.plus(r).pow(t.plus(1)))), new D(0))
  const tol = new D('1e-12')

  let r = new D('0.1')
  for (let k = 0; k < 100; k++) {
    const d = dnpv(r)
    if (d.isZero()) break
    const next = r.minus(npv(r).div(d))
    if (!next.isFinite() || next.lte(-1)) break
    if (next.minus(r).abs().lt(tol)) return { rate: next }
    r = next
  }

  // Bisection: find a bracket in (-1, 1e6], then halve it.
  let lo = new D('-0.999999')
  let hi = new D(1)
  const fLo = npv(lo)
  while (npv(hi).isPositive() === fLo.isPositive() && hi.lt(1e6)) hi = hi.times(10)
  if (npv(hi).isPositive() === fLo.isPositive()) return { error: 'no-solution' }
  for (let k = 0; k < 300 && hi.minus(lo).gt(tol); k++) {
    const mid = lo.plus(hi).div(2)
    if (npv(mid).isPositive() === fLo.isPositive()) lo = mid
    else hi = mid
  }
  return { rate: lo.plus(hi).div(2) }
}
