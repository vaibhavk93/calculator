import { D, type Dec } from '../decimal'
import { byYear, schedule } from './loan'
import { HOME_LOAN_TAX as T } from './rules'

export type Occupancy = 'self' | 'letOut'
export type Regime = 'old' | 'new'

export interface TaxYearRow {
  year: number
  interest: Dec
  principal: Dec
  /** How much the interest lowers taxable income. */
  interestDeduction: Dec
  principalDeduction: Dec
  taxSaved: Dec
}

/**
 * Home-loan tax benefit per loan year (each loan year is treated as one tax year).
 * Old regime: self-occupied interest up to the cap; let-out interest without cap, but the resulting loss
 * counts against other income only up to the set-off cap; principal under s.123 up to what is left of its cap.
 * New regime: nothing for a self-occupied house; let-out interest only down to zero house income.
 * `annualValue` is yearly rent less municipal tax (let-out only). Carried-forward losses are ignored.
 */
export function homeLoanTax(
  p: Dec,
  annualPct: Dec,
  n: number,
  slabPct: Dec,
  occupancy: Occupancy,
  regime: Regime,
  annualValue: Dec,
  section123Used: Dec,
): TaxYearRow[] {
  const houseIncome = occupancy === 'letOut' ? annualValue.times(new D(100).minus(T.standardDeductionPct)).div(100) : new D(0)
  const setOff = regime === 'old' ? new D(T.houseLossSetOffCap) : new D(0)
  const room123 = D.max(0, new D(T.section123Cap).minus(section123Used))
  return byYear(schedule(p, annualPct, n)).map((y) => {
    const interestDeduction =
      occupancy === 'self'
        ? regime === 'old'
          ? D.min(y.interest, T.selfOccupiedInterestCap)
          : new D(0)
        : D.min(y.interest, houseIncome.plus(setOff))
    const principalDeduction = regime === 'old' ? D.min(y.principal, room123) : new D(0)
    return {
      year: y.month,
      interest: y.interest,
      principal: y.principal,
      interestDeduction,
      principalDeduction,
      taxSaved: interestDeduction.plus(principalDeduction).times(slabPct).div(100),
    }
  })
}
