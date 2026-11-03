import { D } from '../decimal'

/**
 * One "loan term" box: "18 months", "20 years", "1.5 years", "18m", "20y". A bare number means years.
 * Returns whole months, or a plain-words error. At most 50 years.
 */
const YEAR = /^(y|yr|yrs|year|years)$/
const MONTH = /^(m|mo|mos|month|months)$/

export function parseTerm(text: string): number | { error: string } {
  const t = text.trim().toLowerCase().replace(/,/g, '')
  if (t === '') return { error: 'Enter loan term' }
  const m = /^(\d*\.?\d+)\s*([a-z]*)$/.exec(t)
  if (!m) return { error: 'Loan term: type a number with months or years, like 18 months or 20 years' }
  const unit = m[2]!
  if (unit !== '' && !YEAR.test(unit) && !MONTH.test(unit)) return { error: 'Loan term: use months or years, like 18 months or 20 years' }
  const n = new D(m[1]!)
  const months = MONTH.test(unit) ? n : n.times(12)
  if (months.lte(0)) return { error: 'Loan term must be more than zero' }
  if (!months.isInteger()) return { error: 'Loan term must come to a whole number of months' }
  if (months.gt(600)) return { error: 'Loan term can be at most 50 years' }
  return months.toNumber()
}

/** The unit chip beside the box: only a bare number needs it, because "years" is then an assumption. */
export const termChip = (text: string): string => (/^\s*(\d*\.?\d+)?\s*$/.test(text) ? 'years' : '')

/**
 * Cards saved before the single term box stored a number plus a separate years/months pick
 * (`tenure` + `tenureUnit`). This turns that pair into the one text the box now holds.
 */
export function legacyTermText(tenure: string, unit: unknown): string {
  const t = tenure.trim()
  return unit === 'months' && /^\d*\.?\d+$/.test(t) ? `${t} months` : t
}
