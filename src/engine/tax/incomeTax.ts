import { D, type Dec } from '../decimal'
import { RULES_FY2026_27, type AgeBand, type Slab, type TaxRules } from './rules.FY2026-27'

export type Regime = 'new' | 'old'

/** Normal (slab-rate) income only. Capital gains at special rates are not handled here. */
export interface TaxInput {
  regime: Regime
  age: AgeBand
  /** Gross salary, including any employer NPS contribution. */
  salary: Dec
  /** Interest, rent after its own deductions, business profit: anything taxed at slab rates. */
  otherIncome: Dec
  /** Both regimes. Capped at a % of basic + DA. */
  employerNps?: Dec
  basicDa?: Dec
  // Old regime only (ignored in the new regime, s.202(2)):
  hraExempt?: Dec
  professionalTax?: Dec
  sec123?: Dec
  ownNps?: Dec
  healthSelf?: Dec
  healthParents?: Dec
  parentsSenior?: boolean
  homeLoanInterest?: Dec
}

export interface SlabRow {
  from: Dec
  to: Dec | null
  ratePct: Dec
  tax: Dec
}

export interface TaxResult {
  regime: Regime
  gross: Dec
  deductions: { label: string; amount: Dec }[]
  totalIncome: Dec
  slabs: SlabRow[]
  slabTax: Dec
  rebate: Dec
  surcharge: Dec
  cess: Dec
  total: Dec
  /** Total tax as a % of gross income; 0 when gross is 0. */
  effectivePct: Dec
}

const Z = new D(0)
const min = (a: Dec, b: Dec) => (a.lt(b) ? a : b)
const pos = (a: Dec) => (a.isNegative() ? Z : a)

/** s.516: nearest Rs 10, paise ignored, 5 rounds up. */
export const round10 = (v: Dec, r: TaxRules = RULES_FY2026_27) => {
  const step = new D(r.roundTo)
  return v.floor().div(step).toDecimalPlaces(0, D.ROUND_HALF_UP).times(step)
}

export function slabRows(income: Dec, slabs: Slab[]): SlabRow[] {
  const rows: SlabRow[] = []
  let from = Z
  for (const s of slabs) {
    const to = s.upTo === null ? null : new D(s.upTo)
    const top = to === null ? income : min(income, to)
    const rate = new D(s.ratePct)
    rows.push({ from, to, ratePct: rate, tax: pos(top.minus(from)).times(rate).div(100) })
    if (to === null || income.lte(to)) break
    from = to
  }
  return rows
}

export const slabsFor = (regime: Regime, age: AgeBand, r: TaxRules = RULES_FY2026_27): Slab[] =>
  regime === 'new' ? r.newRegime.slabs : r.oldRegime.slabs[age]

/** The income up to which no tax is charged: the top of the first (nil) slab. */
export const basicExemption = (regime: Regime, age: AgeBand, r: TaxRules = RULES_FY2026_27) =>
  new D(slabsFor(regime, age, r)[0]!.upTo ?? '0')

function rebateOn(regime: Regime, income: Dec, tax: Dec, r: TaxRules): Dec {
  const reg = regime === 'new' ? r.newRegime : r.oldRegime
  const limit = new D(reg.rebateIncomeLimit)
  if (income.lte(limit)) return min(tax, new D(reg.rebateMax))
  if (!reg.rebateMarginalRelief) return Z
  // s.156(2)(b): tax cannot exceed the income above the limit.
  const excess = income.minus(limit)
  return tax.gt(excess) ? tax.minus(excess) : Z
}

/** Tax after rebate, plus surcharge with marginal relief at each threshold. Before cess. */
function taxAndSurcharge(regime: Regime, age: AgeBand, income: Dec, r: TaxRules): { tax: Dec; surcharge: Dec } {
  const slabTax = slabRows(income, slabsFor(regime, age, r)).reduce((a, s) => a.plus(s.tax), Z)
  const tax = slabTax.minus(rebateOn(regime, income, slabTax, r))
  const band = [...r.surcharge].reverse().find((b) => income.gt(b.above))
  if (!band) return { tax, surcharge: Z }
  let rate = new D(band.ratePct)
  if (regime === 'new') rate = min(rate, new D(r.newRegimeSurchargeCapPct))
  const threshold = new D(band.above)
  const atThreshold = taxAndSurcharge(regime, age, threshold, r)
  // Marginal relief: tax + surcharge may exceed that at the threshold by no more than the income above it.
  const ceiling = atThreshold.tax.plus(atThreshold.surcharge).plus(income.minus(threshold))
  const surcharge = pos(min(tax.times(rate).div(100), ceiling.minus(tax)))
  return { tax, surcharge }
}

export function incomeTax(input: TaxInput, r: TaxRules = RULES_FY2026_27): TaxResult {
  const { regime, age } = input
  const o = r.oldRegime
  const z = (v?: Dec) => pos(v ?? Z)
  const gross = z(input.salary).plus(z(input.otherIncome))
  const deductions: { label: string; amount: Dec }[] = []
  const add = (label: string, amount: Dec) => {
    if (amount.gt(0)) deductions.push({ label, amount })
  }

  let salaryLeft = z(input.salary)
  if (regime === 'old') {
    const hra = min(z(input.hraExempt), salaryLeft)
    add('HRA exemption', hra)
    salaryLeft = salaryLeft.minus(hra)
  }
  const sd = min(new D(regime === 'new' ? r.newRegime.standardDeduction : o.standardDeduction), salaryLeft)
  add('Standard deduction', sd)
  salaryLeft = salaryLeft.minus(sd)
  if (regime === 'old') add('Professional tax', min(min(z(input.professionalTax), new D(o.professionalTaxCap)), salaryLeft))

  const npsPct = regime === 'new' ? r.newRegime.employerNpsPctOfSalary : o.employerNpsPctOfSalary
  add(`Employer NPS (up to ${npsPct}% of basic + DA)`, min(z(input.employerNps), z(input.basicDa).times(npsPct).div(100)))

  if (regime === 'old') {
    add('Home-loan interest, self-occupied', min(z(input.homeLoanInterest), new D(o.homeLoanInterestCap)))
    add('PF, PPF, ELSS, life cover etc. (s.123, old 80C)', min(z(input.sec123), new D(o.sec123Cap)))
    add('Own NPS (s.124(3), old 80CCD(1B))', min(z(input.ownNps), new D(o.ownNpsCap)))
    const selfCap = new D(age === 'below60' ? o.healthSelfCap : o.healthSeniorCap)
    const parentCap = new D(input.parentsSenior ? o.healthSeniorCap : o.healthParentsCap)
    add('Health insurance, self and family (s.126, old 80D)', min(z(input.healthSelf), selfCap))
    add('Health insurance, parents (s.126)', min(z(input.healthParents), parentCap))
  }

  const totalIncome = round10(pos(gross.minus(deductions.reduce((a, d) => a.plus(d.amount), Z))), r)
  const slabs = slabRows(totalIncome, slabsFor(regime, age, r))
  const slabTax = slabs.reduce((a, s) => a.plus(s.tax), Z)
  const rebate = rebateOn(regime, totalIncome, slabTax, r)
  const { tax, surcharge } = taxAndSurcharge(regime, age, totalIncome, r)
  const cess = tax.plus(surcharge).times(r.cessPct).div(100)
  const total = round10(tax.plus(surcharge).plus(cess), r)
  return {
    regime,
    gross,
    deductions,
    totalIncome,
    slabs,
    slabTax,
    rebate,
    surcharge,
    cess,
    total,
    effectivePct: gross.isZero() ? Z : total.div(gross).times(100),
  }
}

export interface Comparison {
  old: TaxResult
  new: TaxResult
  cheaper: Regime | 'same'
  saving: Dec
}

export function compareRegimes(input: Omit<TaxInput, 'regime'>, r: TaxRules = RULES_FY2026_27): Comparison {
  const o = incomeTax({ ...input, regime: 'old' }, r)
  const n = incomeTax({ ...input, regime: 'new' }, r)
  const diff = o.total.minus(n.total)
  return { old: o, new: n, cheaper: diff.isZero() ? 'same' : diff.gt(0) ? 'new' : 'old', saving: diff.abs() }
}

// ---- E2: in-hand salary --------------------------------------------------------

export interface SalaryInput {
  ctc: Dec
  basicPct: Dec
  pfPct: Dec
  /** Employer's PF share (same % as the employee's) is part of the CTC. */
  employerPfInCtc: boolean
  /** A gratuity provision (15/26 of a month's basic a year) is part of the CTC. */
  gratuityInCtc: boolean
  professionalTaxMonthly: Dec
  /** Old regime only. */
  hraExempt: Dec
  age: AgeBand
}

export interface SalaryResult {
  basic: Dec
  employerPf: Dec
  gratuity: Dec
  grossSalary: Dec
  employeePf: Dec
  professionalTax: Dec
  tax: Comparison
  regime: Regime
  incomeTax: Dec
  annualInHand: Dec
  monthlyInHand: Dec
}

export function inHandSalary(s: SalaryInput, r: TaxRules = RULES_FY2026_27): SalaryResult | null {
  if (s.ctc.lte(0) || s.basicPct.lte(0) || s.basicPct.gt(100) || s.pfPct.isNegative()) return null
  const basic = s.ctc.times(s.basicPct).div(100)
  const employeePf = basic.times(s.pfPct).div(100)
  const employerPf = s.employerPfInCtc ? employeePf : Z
  const g = r.gratuity
  const gratuity = s.gratuityInCtc ? basic.times(g.coveredDays).div(g.coveredDivisor).div(12) : Z
  const grossSalary = s.ctc.minus(employerPf).minus(gratuity)
  const professionalTax = pos(s.professionalTaxMonthly).times(12)
  const tax = compareRegimes(
    { age: s.age, salary: grossSalary, otherIncome: Z, sec123: employeePf, professionalTax, hraExempt: s.hraExempt },
    r,
  )
  const regime: Regime = tax.cheaper === 'old' ? 'old' : 'new'
  const incomeTaxDue = tax[regime].total
  const annualInHand = grossSalary.minus(employeePf).minus(professionalTax).minus(incomeTaxDue)
  return {
    basic,
    employerPf,
    gratuity,
    grossSalary,
    employeePf,
    professionalTax,
    tax,
    regime,
    incomeTax: incomeTaxDue,
    annualInHand,
    monthlyInHand: annualInHand.div(12),
  }
}

// ---- E7: presumptive taxation for professionals (s.58, old 44ADA) ---------------

export interface PresumptiveInput {
  receipts: Dec
  cashPct: Dec
  expenses: Dec
  otherIncome: Dec
  regime: Regime
  age: AgeBand
}

export type PresumptiveResult =
  | { eligible: false; limit: Dec }
  | {
      eligible: true
      limit: Dec
      presumptiveIncome: Dec
      actualProfit: Dec
      presumptive: TaxResult
      actual: TaxResult
      /** s.58(3): declaring less than 50% with income above the exemption limit needs books and an audit. */
      actualNeedsAudit: boolean
    }

export function presumptive(p: PresumptiveInput, r: TaxRules = RULES_FY2026_27): PresumptiveResult | null {
  if (p.receipts.isNegative() || p.expenses.isNegative() || p.cashPct.isNegative() || p.cashPct.gt(100)) return null
  const c = r.presumptive
  const limit = new D(p.cashPct.lte(c.lowCashMaxPct) ? c.receiptsLimitLowCash : c.receiptsLimit)
  if (p.receipts.gt(limit)) return { eligible: false, limit }
  const presumptiveIncome = p.receipts.times(c.deemedProfitPct).div(100)
  const actualProfit = p.receipts.minus(p.expenses)
  const run = (business: Dec) =>
    incomeTax({ regime: p.regime, age: p.age, salary: Z, otherIncome: pos(business).plus(pos(p.otherIncome)) }, r)
  const actual = run(actualProfit)
  return {
    eligible: true,
    limit,
    presumptiveIncome,
    actualProfit,
    presumptive: run(presumptiveIncome),
    actual,
    actualNeedsAudit: actualProfit.lt(presumptiveIncome) && actual.totalIncome.gt(basicExemption(p.regime, p.age, r)),
  }
}
