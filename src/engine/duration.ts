import type { Dec } from './decimal'

/**
 * Durations typed in one of three units. Pure maths, Decimal only; the screen keeps the chosen unit
 * next to the number (`<field id>__unit`) and a spec converts here before it calls the real engine.
 */
export type TimeUnit = 'years' | 'months' | 'days'

/** Years in `n` of `unit`. Months are n/12, days are n/365 (the same year the XIRR code uses). A leap year is ignored. */
export const toYears = (n: Dec, unit: TimeUnit): Dec => (unit === 'years' ? n : unit === 'months' ? n.div(12) : n.div(365))

/** Whole months in `n` of `unit`, for tools that pay monthly. Null unless the answer is a whole number of at least 1. */
export function toWholeMonths(n: Dec, unit: 'years' | 'months'): number | null {
  const m = unit === 'years' ? n.times(12) : n
  return m.isInteger() && m.gte(1) ? m.toNumber() : null
}

/**
 * The unit word typed after a number ("18 months" -> months, "20y" -> years), or null for a bare number or anything else.
 * Same words `parseTerm` (src/engine/loans/term.ts) accepts; a test keeps the two in step.
 */
export function typedUnit(text: string): 'years' | 'months' | null {
  const m = /^\s*\d*\.?\d+\s*([a-z]+)\s*$/i.exec(text.replace(/,/g, ''))
  const w = m?.[1]?.toLowerCase()
  return !w ? null : /^(y|yr|yrs|year|years)$/.test(w) ? 'years' : /^(m|mo|mos|month|months)$/.test(w) ? 'months' : null
}

/** "18 months" -> "18", for a box whose unit now lives in the switch. Text without a unit word is returned as it is. */
export const withoutUnit = (text: string): string => (typedUnit(text) ? text.replace(/[a-z\s]+$/i, '') : text)

/** "1 month", "18 months": the singular when the number is exactly 1. */
export const unitText = (n: Dec, unit: TimeUnit): string => (n.eq(1) ? unit.slice(0, -1) : unit)

/** "3 years 2 months", "3 years", "1 month", "11 months": whole months as years and months, singular at exactly 1. */
export function yearsMonthsText(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  const part = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`
  return [y > 0 ? part(y, 'year') : '', m > 0 || y === 0 ? part(m, 'month') : ''].filter(Boolean).join(' ')
}
