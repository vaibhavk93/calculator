import { addDays } from './dates'

/**
 * Next period = last period + cycle length. Ovulation = next period - 14 days.
 * Fertile window = 5 days before ovulation to 1 day after. An estimate for a regular cycle only.
 * Null unless the cycle is 21 to 45 whole days.
 */
export function ovulation(lastPeriod: Date, cycleDays: number): { nextPeriod: Date; ovulation: Date; fertileStart: Date; fertileEnd: Date } | null {
  if (!Number.isInteger(cycleDays) || cycleDays < 21 || cycleDays > 45) return null
  const nextPeriod = addDays(lastPeriod, cycleDays)
  const ov = addDays(nextPeriod, -14)
  return { nextPeriod, ovulation: ov, fertileStart: addDays(ov, -5), fertileEnd: addDays(ov, 1) }
}
