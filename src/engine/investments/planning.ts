import type { Dec } from '../decimal'

/**
 * Personal-finance health checks (PRD D15, D16, D17). Plain arithmetic: no rates, no external data.
 * Percent inputs and outputs are typed percents (36 = 36%).
 */

export interface EmergencyFund {
  /** expenses x target months */
  target: Dec
  /** target - savings. Positive = still to save, negative = more than enough. */
  gap: Dec
  /** How many months of expenses the savings cover. */
  monthsCovered: Dec
}

/** Null when monthly expenses are not above zero (months covered would divide by zero). */
export function emergencyFund(monthlyExpenses: Dec, targetMonths: Dec, savings: Dec): EmergencyFund | null {
  if (!monthlyExpenses.gt(0)) return null
  const target = monthlyExpenses.times(targetMonths)
  return { target, gap: target.minus(savings), monthsCovered: savings.div(monthlyExpenses) }
}

export type DtiBand = 'comfortable' | 'stretched' | 'high'

export interface Dti {
  /** obligations / income x 100 */
  pct: Dec
  band: DtiBand
  /** Monthly EMI room left before reaching the "comfortable" limit. Negative = already over it. */
  roomAtComfortable: Dec
}

/** `comfortable` and `stretched` are the band edges: at or under the first is comfortable, over the second is high. Null when income is not above zero. */
export function debtToIncome(income: Dec, obligations: Dec, comfortable: Dec, stretched: Dec): Dti | null {
  if (!income.gt(0)) return null
  const pct = obligations.div(income).times(100)
  const band: DtiBand = pct.lte(comfortable) ? 'comfortable' : pct.lte(stretched) ? 'stretched' : 'high'
  return { pct, band, roomAtComfortable: income.times(comfortable).div(100).minus(obligations) }
}

export interface SavingsRate {
  saved: Dec
  spent: Dec
  /** saved / income x 100. Negative when spending is above income. */
  pct: Dec
  annualSaved: Dec
}

/** Give either what was spent or what was saved; the other follows. Null when income is not above zero. */
export function savingsRate(income: Dec, known: { spend: Dec } | { saved: Dec }): SavingsRate | null {
  if (!income.gt(0)) return null
  const saved = 'saved' in known ? known.saved : income.minus(known.spend)
  const spent = income.minus(saved)
  return { saved, spent, pct: saved.div(income).times(100), annualSaved: saved.times(12) }
}
