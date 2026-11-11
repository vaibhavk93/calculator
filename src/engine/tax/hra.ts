import { D, type Dec } from '../decimal'
import { RULES_FY2026_27, type TaxRules } from './rules.FY2026-27'

/**
 * House Rent Allowance exemption, Income-tax Rules 2026 Rule 279 (see `rules.FY2026-27.ts` source 7).
 *
 * Everything is MONTHLY and multiplied by `months`, because that is the shape a payslip and a rent
 * receipt come in. Rule 279(2)(a)'s "relevant period" is the part of the tax year the home was
 * actually occupied, which is exactly what `months` means here.
 *
 * Not modelled on purpose: a mid-year pay or rent change (run it twice, once per period, and add the
 * exempt amounts), and two homes in one year. Both are rare enough that a second input row would cost
 * every other user a more complicated screen.
 */
export interface HraInput {
  /** Monthly basic pay. */
  basic: Dec
  /**
   * Monthly dearness allowance. Rule 279(2)(b) counts DA only "if provided for under the terms of
   * employment" — when it is not, pass 0. Every other allowance and perquisite is excluded outright.
   */
  da: Dec
  /** Monthly HRA actually received. */
  hra: Dec
  /** Monthly rent actually paid. Schedule III Sl.11(d): with no rent paid there is no exemption. */
  rent: Dec
  /** One of Rule 279's eight 50% cities (`rules.hra.metroCities`). Anywhere else is 40%. */
  metro: boolean
  /** Months the home was occupied in the tax year, 1-12. */
  months: number
  /** The new regime gives no HRA exemption at all: s.202(2)(a)(i) excludes Schedule III Sl.11. */
  newRegime: boolean
}

export interface HraResult {
  /** Salary for the relevant period: (basic + DA) x months. Rule 279(2)(b). */
  salary: Dec
  /** HRA received over the relevant period. */
  received: Dec
  /** Rent paid over the relevant period. */
  rentPaid: Dec
  /** The three limbs of Rule 279(1), in the rule's own order. The exemption is the least of them. */
  limbs: { actual: Dec; rentOverTenth: Dec; shareOfSalary: Dec }
  /** Which limb decided it, for the explanation on screen. */
  binding: 'actual' | 'rentOverTenth' | 'shareOfSalary'
  exempt: Dec
  taxable: Dec
  /** Rule 205, Form No. 124 Table Sl.1: the landlord's PAN is required above this much rent in a year. */
  landlordPanNeeded: boolean
}

export function hraExemption(h: HraInput, r: TaxRules = RULES_FY2026_27): HraResult | null {
  const k = r.hra
  if (!Number.isInteger(h.months) || h.months < 1 || h.months > 12) return null
  for (const v of [h.basic, h.da, h.hra, h.rent]) if (v.isNegative()) return null

  const salary = h.basic.plus(h.da).times(h.months)
  const received = h.hra.times(h.months)
  const rentPaid = h.rent.times(h.months)

  // Rule 279(1): least of (a) the allowance, (b) rent less one-tenth of salary, (c) a share of salary.
  const actual = received
  const rentOverTenth = rentPaid.minus(salary.times(k.rentLessSalaryPct).div(100))
  const shareOfSalary = salary.times(h.metro ? k.metroPct : k.otherPct).div(100)

  const limbs = { actual, rentOverTenth, shareOfSalary }
  // Never negative: paying less rent than a tenth of salary means no exemption, not a deduction.
  const least = D.max(D.min(actual, rentOverTenth, shareOfSalary), new D(0))
  const exempt = h.newRegime ? new D(0) : least

  // Report the limb that actually bound, so the screen can say why. Ties resolve in the rule's order.
  const binding = least.eq(actual) ? 'actual' : least.eq(rentOverTenth) ? 'rentOverTenth' : 'shareOfSalary'

  return {
    salary,
    received,
    rentPaid,
    limbs,
    binding,
    exempt,
    taxable: received.minus(exempt),
    landlordPanNeeded: rentPaid.gt(k.landlordPanAbove),
  }
}
